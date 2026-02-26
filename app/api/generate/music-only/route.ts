import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { findBestMatchingLyrics } from '@/lib/lyrics-matcher'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { notifyGenerationComplete, notifyGenerationFailed, notifyCreditDeduct } from '@/lib/notifications'

// Allow up to 5 minutes for music generation (Vercel Pro limit: 300s)
export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

/**
 * Sanitize error messages to hide technical details from users
 */
function sanitizeError(error: any): string {
  const errorStr = error instanceof Error ? error.message : String(error)
  
  // Hide all technical details - users should only see generic message
  if (errorStr.includes('429') || 
      errorStr.includes('rate limit') || 
      errorStr.includes('replicate') ||
      errorStr.includes('supabase') ||
      errorStr.includes('cloudflare') ||
      errorStr.includes('vercel') ||
      errorStr.includes('API') ||
      errorStr.includes('throttled') ||
      errorStr.includes('prediction') ||
      errorStr.includes('status') ||
      errorStr.includes('failed with')) {
    return '444 radio is locking in, please try again in few minutes'
  }
  
  // Generic fallback for any other technical errors
  return '444 radio is locking in, please try again in few minutes'
}

/**
 * Expand lyrics to reach target length based on duration
 * Short: 200-300 chars, Medium: 350-500 chars, Long: 500-600 chars
 */
function expandLyricsForDuration(baseLyrics: string, duration: 'short' | 'medium' | 'long' = 'medium'): string {
  const targetLengths = {
    short: { min: 200, max: 300 },
    medium: { min: 350, max: 500 },
    long: { min: 500, max: 600 }
  }
  
  const target = targetLengths[duration]
  
  // If lyrics are already long enough, return them (trimmed if needed)
  if (baseLyrics.length >= target.min) {
    return baseLyrics.length > 600 ? baseLyrics.substring(0, 597) + '...' : baseLyrics
  }
  
  // Add song structure to expand lyrics
  let expandedLyrics = baseLyrics
  
  // Add verse 2 if needed
  if (expandedLyrics.length < target.min) {
    expandedLyrics += `\n\n[Verse 2]\n${baseLyrics}`
  }
  
  // Add chorus if still needed
  if (expandedLyrics.length < target.min) {
    const chorusLines = baseLyrics.split('\n').slice(0, 2).join('\n')
    expandedLyrics += `\n\n[Chorus]\n${chorusLines}`
  }
  
  // Add bridge for long songs
  if (duration === 'long' && expandedLyrics.length < target.min) {
    const bridgeLines = baseLyrics.split('\n').slice(0, 2).join('\n')
    expandedLyrics += `\n\n[Bridge]\n${bridgeLines}`
  }
  
  // Add outro for long songs
  if (duration === 'long' && expandedLyrics.length < target.max) {
    const outroLines = baseLyrics.split('\n').slice(0, 1).join('\n')
    expandedLyrics += `\n\n[Outro]\n${outroLines}`
  }
  
  // Trim if too long
  if (expandedLyrics.length > 600) {
    expandedLyrics = expandedLyrics.substring(0, 597) + '...'
  }
  
  return expandedLyrics
}

// POST /api/generate/music-only - Generate ONLY music (no song record)
// For standalone music generation with preview
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, prompt, lyrics, duration = 'medium', genre, bpm, bitrate = 256000, sample_rate = 44100, audio_format = 'wav', language = 'English', audio_length_in_s, num_inference_steps, guidance_scale, denoising_strength, generateCoverArt = false } = await req.json()

    // Title is REQUIRED (3-100 characters)
    if (!title || typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 100) {
      return NextResponse.json({ error: 'Title is required (3-100 characters)' }, { status: 400 })
    }

    // Prompt is REQUIRED (Replicate model limit: 300 chars)
    if (!prompt || prompt.length < 10 || prompt.length > 300) {
      return NextResponse.json({ error: 'Prompt is required (10-300 characters)' }, { status: 400 })
    }
    
    console.log('🎵 Music Generation Parameters:')
    console.log('  Title:', title)
    console.log('  Prompt:', prompt)
    console.log('  Genre:', genre || 'not specified')
    console.log('  BPM:', bpm || 'not specified')
    console.log('  Duration:', duration)
    console.log('  Language:', language)

    // If lyrics not provided, use intelligent default from dataset
    let formattedLyrics: string
    let used444Radio = false
    
    if (!lyrics || typeof lyrics !== 'string' || lyrics.trim().length === 0) {
      // Use smart lyrics matcher based on prompt (supports 444 trigger and genre matching)
      console.log('⚡ No custom lyrics provided, using smart lyrics matcher')
      console.log('  Received lyrics value:', lyrics, 'Type:', typeof lyrics)
      console.log('  Requested duration:', duration)
      
      // Check if user wants 444 Radio lyrics
      const wants444 = prompt.toLowerCase().includes('444')
      
      if (wants444) {
        // Check daily limit for 444 Radio lyrics
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        
        const userCheckRes = await fetch(
          `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=last_444_radio_date`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          }
        )
        
        const userCheckData = await userCheckRes.json()
        const userRecord = userCheckData?.[0]
        
        const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
        const lastUsedDate = userRecord?.last_444_radio_date
        
        if (lastUsedDate === today) {
          // User already used 444 Radio lyrics today
          return NextResponse.json({ 
            error: 'Daily 444 Radio limit reached',
            message: '444 Radio lyrics can only be generated once per day. Try again tomorrow or use custom lyrics!'
          }, { status: 429 })
        }
        
        used444Radio = true
      }
      
      const matchedSong = findBestMatchingLyrics(prompt)
      const baseLyrics = matchedSong.lyrics
      // Expand lyrics based on requested duration
      formattedLyrics = expandLyricsForDuration(baseLyrics, duration as 'short' | 'medium' | 'long')
      console.log('📝 Selected lyrics from smart matcher')
      console.log('  Song title:', matchedSong.title)
      console.log('  Genre:', matchedSong.genre)
      console.log('  Base lyrics length:', baseLyrics.length)
      console.log('  Expanded lyrics length:', formattedLyrics.length)
      console.log('  Duration:', duration)
      console.log('  Used 444 Radio:', used444Radio)
    } else {
      // Validate and expand user-provided lyrics
      console.log('📝 Using custom user-provided lyrics')
      console.log('  Original lyrics length:', lyrics.length)
      console.log('  Requested duration:', duration)
      // Expand user's custom lyrics based on duration
      formattedLyrics = expandLyricsForDuration(lyrics.trim(), duration as 'short' | 'medium' | 'long')
      console.log('  Final lyrics length:', formattedLyrics.length)
    }
    
    // CRITICAL: Ensure lyrics are NEVER empty and within API limits before sending to Replicate
    if (!formattedLyrics || formattedLyrics.length < 10) {
      console.error('❌ CRITICAL: Formatted lyrics are invalid!', formattedLyrics)
      // Fallback to a safe default
      const fallbackSong = findBestMatchingLyrics('chill vibes')
      formattedLyrics = fallbackSong.lyrics
      console.log('  ⚠️ Using fallback lyrics, length:', formattedLyrics.length)
    }
    
    // CRITICAL: Validate lyrics length for API (10-600 characters)
    if (formattedLyrics.length > 600) {
      console.warn('⚠️ Lyrics too long for API, trimming to 600 characters')
      console.log('  Original length:', formattedLyrics.length)
      // Trim to 600 characters at a word boundary
      formattedLyrics = formattedLyrics.substring(0, 597).trim() + '...'
      console.log('  Trimmed length:', formattedLyrics.length)
    }
    
    console.log('🎵 Music Generation Request:')
    console.log('  Prompt:', prompt)
    console.log('  Lyrics length:', formattedLyrics.length)
    console.log('  Lyrics preview:', formattedLyrics.substring(0, 100) + '...')
    console.log('  Bitrate:', bitrate)
    console.log('  Sample rate:', sample_rate)
    console.log('  Format:', audio_format)
    console.log('  Language:', language)

    // Check user credits (music costs 2 credits)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    )
    
    const users = await userRes.json()
    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userCredits = users[0].credits || 0
    if (userCredits < 2) {
      return NextResponse.json({ 
        error: 'Insufficient credits. Music generation requires 2 credits.',
        creditsNeeded: 2,
        creditsAvailable: userCredits
      }, { status: 402 })
    }

    console.log(`💰 User has ${userCredits} credits. Music requires 2 credits.`)

    // ✅ DEDUCT 2 CREDITS atomically BEFORE generation
    const deductRes = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_clerk_user_id: userId, p_amount: 2 })
    })
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) {
      const raw = await deductRes.json()
      deductResult = Array.isArray(raw) ? raw[0] ?? null : raw
    }
    if (!deductRes.ok || !deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      console.error('❌ Credit deduction blocked:', errorMsg)
      await logCreditTransaction({ userId, amount: -2, type: 'generation_music', status: 'failed', description: `Music: ${title}`, metadata: { prompt, genre } })
      return NextResponse.json({ error: errorMsg }, { status: 402 })
    }
    console.log(`✅ Credits deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId, amount: -2, balanceAfter: deductResult.new_credits, type: 'generation_music', description: `Music: ${title}`, metadata: { prompt, genre } })

    // Only route Hindi-family languages to fal.ai V2; all others (Spanish, etc.) use MiniMax 1.5
    const hindiLanguages = ['hindi', 'urdu', 'punjabi', 'tamil', 'telugu']
    const langLower = (language || '').toLowerCase()
    const isHindiFamily = hindiLanguages.includes(langLower)
    // Also detect Devanagari/South Asian scripts in lyrics as Hindi-family
    const hasIndicScript = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/.test(formattedLyrics)
    const useHindiModel = isHindiFamily || hasIndicScript

    if (useHindiModel) {
      // ============ FAL.AI MINIMAX 2.0 PATH ============
      const falKey = process.env.FAL_KEY || process.env.fal_key
      if (!falKey) {
        console.error('❌ FAL_KEY not set — cannot use MiniMax 2.0')
        // Refund and error
        await refundCredits({ userId, amount: 2, type: 'generation_music', reason: `FAL_KEY missing: ${title}`, metadata: { prompt, genre } })
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
      }

      const reason = isHindiFamily ? `language: ${language}` :
                     `Indic script in lyrics`
      console.log(`🎵 Hindi-family detected (${reason}) → routing to MiniMax 2.0 via fal.ai`)

      const chosenFormat = (audio_format === 'wav' || audio_format === 'flac') ? 'flac' : 'mp3'
      const minimax2Input: Record<string, unknown> = {
        prompt: prompt.trim().substring(0, 300),
        audio_setting: {
          sample_rate: 44100,
          bitrate: 256000,
          format: chosenFormat,
        },
      }
      // MiniMax V2 uses lyrics_prompt (10-3000 chars)
      // Supported structure tags: [Intro], [Verse], [Chorus], [Bridge], [Outro]
      if (formattedLyrics && formattedLyrics.trim().length > 0 &&
          !formattedLyrics.toLowerCase().includes('[instrumental]')) {
        let sanitizedLyrics = formattedLyrics.trim()
        // Replace unsupported [hook] tags with [chorus]
        sanitizedLyrics = sanitizedLyrics.replace(/\[hook\]/gi, '[chorus]')
        // Remove any other unsupported tags (keep only intro/verse/chorus/bridge/outro)
        sanitizedLyrics = sanitizedLyrics.replace(/\[(?!intro\]|verse\]|chorus\]|bridge\]|outro\])([^\]]+)\]/gi, '')
        // Remove trailing empty tags (tag at end with no content after it)
        sanitizedLyrics = sanitizedLyrics.replace(/\[(intro|verse|chorus|bridge|outro)\]\s*$/gi, '').trim()
        minimax2Input.lyrics_prompt = sanitizedLyrics.substring(0, 3000)
      }

      console.log('🎵 [MiniMax2] Input:', JSON.stringify(minimax2Input, null, 2))

      const encoder = new TextEncoder()
      const stream = new TransformStream()
      const writer = stream.writable.getWriter()
      let clientDisconnected = false

      const sendLine = async (data: Record<string, unknown>) => {
        if (clientDisconnected) return
        try {
          await writer.write(encoder.encode(JSON.stringify(data) + '\n'))
        } catch {
          clientDisconnected = true
        }
      }

      const requestSignal = req.signal

      ;(async () => {
        try {
          await sendLine({ type: 'started', model: 'minimax-music-02' })

          // Call fal.ai synchronous endpoint
          const falRes = await fetch(`https://fal.run/fal-ai/minimax-music/v2`, {
            method: 'POST',
            headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(minimax2Input),
          })

          if (!falRes.ok) {
            const body = await falRes.text()
            console.error('❌ [MiniMax2] fal.ai error:', falRes.status, body.substring(0, 500))
            throw new Error(`MiniMax2 request failed (${falRes.status})`)
          }

          const data = await falRes.json()

          if (requestSignal.aborted && !clientDisconnected) {
            console.log('🔄 Client disconnected but completing MiniMax 2.0 gen')
            clientDisconnected = true
          }

          // Extract audio URL
          let audioUrl: string | undefined
          if (data?.audio?.url) audioUrl = data.audio.url
          else if (data?.audio && typeof data.audio === 'string') audioUrl = data.audio
          else if (typeof data?.output === 'string') audioUrl = data.output
          if (!audioUrl) throw new Error('No audio in MiniMax 2.0 output')

          console.log('🎵 [MiniMax2] Audio URL:', audioUrl)

          // Upload to R2
          const ext = chosenFormat === 'flac' ? 'flac' : 'mp3'
          const fileName = `${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.${ext}`
          const r2Result = await downloadAndUploadToR2(audioUrl, userId, 'music', fileName)
          if (!r2Result.success) throw new Error(`R2 upload failed: ${r2Result.error}`)
          audioUrl = r2Result.url
          console.log('✅ R2 upload:', audioUrl)

          // Save to music_library
          const libraryEntry = {
            clerk_user_id: userId,
            title,
            prompt,
            lyrics: formattedLyrics,
            audio_url: audioUrl,
            audio_format: chosenFormat,
            bitrate: chosenFormat === 'mp3' ? 256000 : 0,
            sample_rate: 44100,
            generation_params: { model: 'minimax-music-02', language, audio_format: chosenFormat },
            status: 'ready',
          }
          const saveRes = await fetch(`${supabaseUrl}/rest/v1/music_library`, {
            method: 'POST',
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
            body: JSON.stringify(libraryEntry),
          })
          let savedMusic: any = null
          if (saveRes.ok) {
            const d = await saveRes.json()
            savedMusic = Array.isArray(d) ? d[0] : d
            console.log('✅ Saved to music_library:', savedMusic?.title)
          }

          // Save to combined_media
          let savedCombined: any = null
          try {
            const combinedRes = await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
              method: 'POST',
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
              body: JSON.stringify({
                user_id: userId, type: 'audio', title, audio_prompt: prompt, lyrics: formattedLyrics, audio_url: audioUrl,
                image_url: null, is_public: false, genre: genre || null,
                metadata: JSON.stringify({ source: 'music-only-autodetect', model: 'minimax-music-02', language, audio_format: chosenFormat }),
              }),
            })
            if (combinedRes.ok) {
              const d = await combinedRes.json()
              savedCombined = Array.isArray(d) ? d[0] : d
            }
          } catch (cmErr) {
            console.error('❌ combined_media save error:', cmErr)
          }

          const libraryId = savedMusic?.id || savedCombined?.id || null

          // Quest progress
          try {
            const { trackQuestProgress, trackModelUsage, trackGenerationStreak } = await import('@/lib/quest-progress')
            trackQuestProgress(userId, 'generate_songs').catch(() => {})
            if (genre) trackQuestProgress(userId, 'use_genres', 1, genre).catch(() => {})
            trackModelUsage(userId, 'minimax-music-02').catch(() => {})
            trackGenerationStreak(userId).catch(() => {})
          } catch {}

          updateTransactionMedia({ userId, type: 'generation_music', mediaUrl: audioUrl!, mediaType: 'audio', title, extraMeta: { genre, model: 'minimax-music-02' } }).catch(() => {})
          notifyGenerationComplete(userId, libraryId || '', 'music', title).catch(() => {})
          notifyCreditDeduct(userId, 2, `Music: ${title}`).catch(() => {})

          const response: Record<string, unknown> = {
            type: 'result', success: true, audioUrl, title, lyrics: formattedLyrics, libraryId,
            creditsRemaining: deductResult!.new_credits, creditsDeducted: 2,
          }

          // Optional cover art (same logic as below)
          if (generateCoverArt && deductResult!.new_credits >= 1) {
            try {
              const imagePrompt = `${prompt} music album cover art, ${genre || 'electronic'} style, professional music artwork`
              const imagePrediction = await replicate.predictions.create({
                model: 'prunaai/z-image-turbo',
                input: { prompt: imagePrompt, width: 1024, height: 1024, output_format: 'jpg', output_quality: 100, guidance_scale: 0, num_inference_steps: 8, go_fast: false },
              })
              let imageResult = await replicate.predictions.get(imagePrediction.id)
              let imgAttempts = 0
              while (imageResult.status !== 'succeeded' && imageResult.status !== 'failed' && imgAttempts < 40) {
                await new Promise(r => setTimeout(r, 1000))
                imageResult = await replicate.predictions.get(imagePrediction.id)
                imgAttempts++
              }
              if (imageResult.status === 'succeeded' && imageResult.output) {
                const imageUrls = Array.isArray(imageResult.output) ? imageResult.output : [imageResult.output]
                let imageUrl = imageUrls[0]
                if (typeof imageUrl === 'object' && 'url' in imageUrl) imageUrl = (imageUrl as any).url()
                const imageFileName = `${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-cover-${Date.now()}.jpg`
                const imageR2 = await downloadAndUploadToR2(imageUrl, userId, 'images', imageFileName)
                if (imageR2.success) {
                  response.imageUrl = imageR2.url
                  await logCreditTransaction({ userId, amount: -1, balanceAfter: deductResult!.new_credits - 1, type: 'generation_cover_art', description: `Cover art: ${title}`, metadata: { prompt: imagePrompt } })
                }
              }
            } catch (imgErr) {
              console.error('❌ Cover art error:', imgErr)
            }
          }

          await sendLine(response)
          await writer.close().catch(() => {})
        } catch (error) {
          console.error('❌ MiniMax 2.0 generation error:', error)
          await refundCredits({ userId, amount: 2, type: 'generation_music', reason: `Error: ${String(error).substring(0, 80)}`, metadata: { prompt, genre, error: String(error).substring(0, 200) } })
          notifyGenerationFailed(userId, 'music', 'Generation error — credits refunded').catch(() => {})
          try {
            await sendLine({ type: 'result', success: false, error: sanitizeError(error) })
            await writer.close()
          } catch { /* stream may already be closed */ }
        }
      })()

      return new Response(stream.readable, {
        headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache', 'Transfer-Encoding': 'chunked' },
      })
    }

    // ============ MINIMAX 1.5 PATH (all languages except Hindi-family) ============
    // Generate music with MiniMax Music-1.5 via Replicate
    // Use NDJSON streaming so the client gets the prediction ID immediately for cancellation
    console.log('🎵 Using MiniMax Music-1.5 ...')

    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    // Track if client navigated away so we still finish the generation
    let clientDisconnected = false

    // Helper to send a JSON line — swallows errors if client is gone
    const sendLine = async (data: Record<string, unknown>) => {
      if (clientDisconnected) return
      try {
        await writer.write(encoder.encode(JSON.stringify(data) + '\n'))
      } catch {
        clientDisconnected = true
      }
    }

    // Capture the request signal so the IIFE can detect client disconnect
    const requestSignal = req.signal

    // Start async processing
    ;(async () => {
      try {
        // Create prediction (non-blocking)
        const prediction = await replicate.predictions.create({
          model: "minimax/music-1.5",
          input: {
            prompt: prompt.trim(),
            lyrics: formattedLyrics,
            bitrate,
            sample_rate,
            audio_format
          }
        })

        console.log('🎵 Prediction created:', prediction.id)

        // Send prediction ID to client immediately
        await sendLine({ type: 'started', predictionId: prediction.id })

        // Poll until done — also check if client disconnected via requestSignal
        let finalPrediction = prediction
        let attempts = 0
        const maxAttempts = 150 // 300s at 2s intervals

        while (
          finalPrediction.status !== 'succeeded' &&
          finalPrediction.status !== 'failed' &&
          finalPrediction.status !== 'canceled' &&
          attempts < maxAttempts
        ) {
          // If the client disconnected (navigated away / switched tabs), DON'T cancel.
          // Let the generation complete and save to DB so the user finds it in their library.
          if (requestSignal.aborted && !clientDisconnected) {
            console.log('🔄 Client disconnected but continuing generation:', prediction.id)
            clientDisconnected = true
          }
          await new Promise(resolve => setTimeout(resolve, 2000))
          finalPrediction = await replicate.predictions.get(prediction.id)
          attempts++
        }

        if (finalPrediction.status === 'canceled') {
          console.log('⏹ Prediction cancelled by user:', prediction.id)
          await refundCredits({ userId, amount: 2, type: 'generation_music', reason: `Cancelled by user: ${title}`, metadata: { prompt, genre, reason: 'user_cancelled' } })
          notifyGenerationFailed(userId, 'music', 'Generation cancelled — credits refunded').catch(() => {})
          await sendLine({ type: 'result', success: false, error: 'Generation cancelled', creditsRemaining: deductResult!.new_credits })
          await writer.close().catch(() => {})
          return
        }

        if (finalPrediction.status !== 'succeeded') {
          const errMsg = finalPrediction.error || `Generation ${finalPrediction.status === 'failed' ? 'failed' : 'timed out'}`
          console.error('❌ Prediction did not succeed:', errMsg)
          await refundCredits({ userId, amount: 2, type: 'generation_music', reason: `Failed: ${title}`, metadata: { prompt, genre, error: String(errMsg).substring(0, 200) } })
          notifyGenerationFailed(userId, 'music', 'Generation failed — credits refunded').catch(() => {})
          await sendLine({ type: 'result', success: false, error: sanitizeError(errMsg), creditsRemaining: deductResult!.new_credits })
          await writer.close().catch(() => {})
          return
        }

        console.log('✅ Generation succeeded, processing output...')
        const output = finalPrediction.output

        let audioUrl: string
        if (typeof output === 'string') {
          audioUrl = output
        } else if (output && typeof (output as { url?: () => string }).url === 'function') {
          audioUrl = (output as { url: () => string }).url()
        } else if (output && typeof output === 'object' && 'url' in output) {
          audioUrl = (output as { url: string }).url
        } else {
          console.error('❌ Unexpected output format:', output)
          throw new Error('Invalid output format from API')
        }

        console.log('🎵 Audio URL extracted:', audioUrl)

        // Upload to R2 for permanent storage (MANDATORY)
        console.log('📦 Uploading to R2 for permanent storage...')
        const fileName = `${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.${audio_format}`

        const r2Result = await downloadAndUploadToR2(audioUrl, userId, 'music', fileName)
        if (!r2Result.success) {
          throw new Error(`Failed to upload to permanent storage: ${r2Result.error}`)
        }
        console.log('✅ R2 upload successful!', { r2Url: r2Result.url, key: r2Result.key })
        audioUrl = r2Result.url

        // Save to music_library
        console.log('💾 Saving to music library...')
        const libraryEntry = {
          clerk_user_id: userId,
          title,
          prompt,
          lyrics: formattedLyrics,
          audio_url: audioUrl,
          audio_format,
          bitrate,
          sample_rate,
          generation_params: { bitrate, sample_rate, audio_format, language },
          status: 'ready'
        }

        const saveResponse = await fetch(`${supabaseUrl}/rest/v1/music_library`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(libraryEntry)
        })

        let savedMusic: any = null
        if (saveResponse.ok) {
          const saveData = await saveResponse.json()
          savedMusic = Array.isArray(saveData) ? saveData[0] : saveData
          console.log('✅ Saved to music_library:', savedMusic?.title)
        } else {
          const errBody = await saveResponse.text().catch(() => 'no body')
          console.error('❌ Failed to save to music_library:', saveResponse.status, errBody)
        }

        // Also save to combined_media as fallback (library reads from both tables)
        let savedCombined: any = null
        try {
          const combinedEntry: Record<string, unknown> = {
            user_id: userId,
            type: 'audio',
            title,
            audio_prompt: prompt,
            lyrics: formattedLyrics,
            audio_url: audioUrl,
            image_url: null,
            is_public: false,
            genre: genre || null,
            metadata: JSON.stringify({ source: 'music-only', audio_format, bitrate, sample_rate, language })
          }
          const combinedRes = await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(combinedEntry)
          })
          if (combinedRes.ok) {
            const combinedData = await combinedRes.json()
            savedCombined = Array.isArray(combinedData) ? combinedData[0] : combinedData
            console.log('✅ Saved to combined_media:', savedCombined?.id)
          } else {
            const errBody = await combinedRes.text().catch(() => 'no body')
            console.error('❌ Failed to save to combined_media:', combinedRes.status, errBody)
          }
        } catch (cmErr) {
          console.error('❌ combined_media save error:', cmErr)
        }

        // Use whichever save succeeded for the library ID
        const libraryId = savedMusic?.id || savedCombined?.id || null

        // Record 444 Radio lyrics usage
        if (used444Radio) {
          const today = new Date().toISOString().split('T')[0]
          await fetch(`${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ last_444_radio_date: today })
          })
        }

        console.log('✅ Music generated successfully:', audioUrl)

        // Quest progress: fire-and-forget
        const { trackQuestProgress, trackModelUsage, trackGenerationStreak } = await import('@/lib/quest-progress')
        trackQuestProgress(userId, 'generate_songs').catch(() => {})
        if (genre) trackQuestProgress(userId, 'use_genres', 1, genre).catch(() => {})
        
        // Track instrumental generation if lyrics are minimal
        const isInstrumental = !formattedLyrics || formattedLyrics.length < 30 || formattedLyrics.toLowerCase().includes('[instrumental]')
        if (isInstrumental) {
          trackQuestProgress(userId, 'create_instrumental').catch(() => {})
        }
        
        // Track model usage and generation streak
        trackModelUsage(userId, 'chirp-v3-5').catch(() => {})
        trackGenerationStreak(userId).catch(() => {})

        // Update transaction with output media
        updateTransactionMedia({ userId, type: 'generation_music', mediaUrl: audioUrl, mediaType: 'audio', title, extraMeta: { genre } }).catch(() => {})

        // Notify user of successful generation
        notifyGenerationComplete(userId, libraryId || '', 'music', title).catch(() => {})
        notifyCreditDeduct(userId, 2, `Music generation: ${title}`).catch(() => {})

        const response: any = {
          type: 'result',
          success: true,
          audioUrl,
          title,
          lyrics: formattedLyrics,
          libraryId,
          creditsRemaining: deductResult!.new_credits,
          creditsDeducted: 2
        }

        // Generate cover art if requested
        if (generateCoverArt && deductResult!.new_credits >= 1) {
          try {
            const imagePrompt = `${prompt} music album cover art, ${genre || 'electronic'} style, professional music artwork`
            const imagePrediction = await replicate.predictions.create({
              model: "prunaai/z-image-turbo",
              input: {
                prompt: imagePrompt,
                width: 1024,
                height: 1024,
                output_format: "jpg",
                output_quality: 100,
                guidance_scale: 0,
                num_inference_steps: 8,
                go_fast: false
              }
            })

            let imageResult = await replicate.predictions.get(imagePrediction.id)
            let imgAttempts = 0
            while (imageResult.status !== 'succeeded' && imageResult.status !== 'failed' && imgAttempts < 40) {
              await new Promise(resolve => setTimeout(resolve, 1000))
              imageResult = await replicate.predictions.get(imagePrediction.id)
              imgAttempts++
            }

            if (imageResult.status === 'succeeded' && imageResult.output) {
              const imageUrls = Array.isArray(imageResult.output) ? imageResult.output : [imageResult.output]
              let imageUrl = imageUrls[0]
              if (typeof imageUrl === 'object' && 'url' in imageUrl && typeof (imageUrl as any).url === 'function') {
                imageUrl = (imageUrl as any).url()
              }

              const imageFileName = `${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-cover-${Date.now()}.jpg`
              const imageR2Result = await downloadAndUploadToR2(imageUrl, userId, 'images', imageFileName)
              if (imageR2Result.success) {
                response.imageUrl = imageR2Result.url

                // Save to images_library
                const imageRes = await fetch(`${supabaseUrl}/rest/v1/images_library`, {
                  method: 'POST',
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                  },
                  body: JSON.stringify({
                    user_id: userId,
                    image_url: imageR2Result.url,
                    prompt: imagePrompt,
                    created_at: new Date().toISOString()
                  })
                })
                if (imageRes.ok) {
                  const savedImage = await imageRes.json()
                  response.imageLibraryId = Array.isArray(savedImage) ? savedImage[0].id : savedImage.id
                }
              }
              // Log cover art transaction
              await logCreditTransaction({ userId, amount: -1, balanceAfter: deductResult!.new_credits - 1, type: 'generation_cover_art', description: `Cover art: ${title}`, metadata: { prompt: imagePrompt } })
            }
          } catch (imageError) {
            console.error('❌ Cover art error:', imageError)
            await logCreditTransaction({ userId, amount: 0, type: 'generation_cover_art', status: 'failed', description: `Cover art failed: ${title}`, metadata: { error: String(imageError).substring(0, 200) } })
          }
        }

        if (clientDisconnected) {
          console.log('✅ Generation completed in background (client navigated away):', title)
          console.log('  📚 Saved to music_library:', !!savedMusic, '+ combined_media:', !!savedCombined)
        }

        await sendLine(response)
        await writer.close().catch(() => {})

      } catch (error) {
        console.error('❌ Music generation error (stream):', error)
        await refundCredits({ userId, amount: 2, type: 'generation_music', reason: `Error: ${String(error).substring(0, 80)}`, metadata: { prompt, genre, error: String(error).substring(0, 200) } })
        notifyGenerationFailed(userId, 'music', 'Generation error — credits refunded').catch(() => {})
        try {
          await sendLine({ type: 'result', success: false, error: sanitizeError(error) })
          await writer.close()
        } catch { /* stream may already be closed */ }
      }
    })()

    // Return the streaming response immediately
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked'
      }
    })

  } catch (error) {
    console.error('❌ Music generation error:', error)
    console.log('💰 No credits deducted due to error')
    return NextResponse.json(
      {
        success: false,
        error: sanitizeError(error),
        creditsRefunded: false,
      },
      { status: 500 }
    )
  }
}

