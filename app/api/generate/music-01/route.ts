import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { notifyGenerationComplete, notifyGenerationFailed, notifyCreditDeduct } from '@/lib/notifications'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { findBestMatchingLyrics } from '@/lib/lyrics-matcher'

// Allow up to 5 minutes for music generation
export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Sanitize error messages to hide technical details from users
 */
function sanitizeError(error: unknown): string {
  return '444 radio is locking in, please try again in few minutes'
}

/**
 * Expand lyrics to reach target length based on duration
 */
function expandLyricsForDuration(baseLyrics: string, duration: 'short' | 'medium' | 'long' = 'medium'): string {
  const targetLengths = {
    short: { min: 150, max: 300 },
    medium: { min: 250, max: 400 },
    long: { min: 350, max: 400 }
  }

  const target = targetLengths[duration]

  if (baseLyrics.length >= target.min) {
    return baseLyrics.length > 400 ? baseLyrics.substring(0, 397) + '...' : baseLyrics
  }

  let expandedLyrics = baseLyrics

  if (expandedLyrics.length < target.min) {
    expandedLyrics += `\n\n[Verse 2]\n${baseLyrics}`
  }
  if (expandedLyrics.length < target.min) {
    const chorusLines = baseLyrics.split('\n').slice(0, 2).join('\n')
    expandedLyrics += `\n\n[Chorus]\n${chorusLines}`
  }

  // MiniMax 01 max lyrics is 400 chars
  if (expandedLyrics.length > 400) {
    expandedLyrics = expandedLyrics.substring(0, 397) + '...'
  }

  return expandedLyrics
}

export function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/generate/music-01
 * 
 * Generate music using minimax/music-01 with advanced features:
 * - voice_id: Use a previously trained voice
 * - voice_file: Voice reference file URL (.wav or .mp3, >15s)
 * - instrumental_file: Instrumental reference file URL (.wav or .mp3, >15s)
 * - song_file: Reference song file URL (.wav or .mp3, >15s)
 * 
 * Costs 3 credits per generation.
 * 
 * Body: {
 *   title: string,
 *   prompt: string,     // Used for auto-fill only, not sent to model
 *   lyrics?: string,
 *   duration?: 'short' | 'medium' | 'long',
 *   genre?: string,
 *   voice_id?: string,       // Trained voice ID
 *   voice_file?: string,     // Voice reference URL
 *   song_file?: string,      // Reference song URL
 *   instrumental_file?: string, // Instrumental reference URL
 *   instrumental_id?: string,   // Previously uploaded instrumental ID (future)
 *   sample_rate?: number,
 *   bitrate?: number,
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const {
      title,
      prompt,
      lyrics,
      duration = 'medium',
      genre,
      voice_id,
      voice_file,
      song_file,
      instrumental_file,
      instrumental_id,
      sample_rate = 44100,
      bitrate = 256000,
    } = body

    // Title is required
    if (!title || typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 100) {
      return corsResponse(NextResponse.json({ error: 'Title is required (3-100 characters)' }, { status: 400 }))
    }

    // Prompt is required for auto-fill (10-300 chars)
    if (!prompt || prompt.length < 10 || prompt.length > 300) {
      return corsResponse(NextResponse.json({ error: 'Prompt is required (10-300 characters)' }, { status: 400 }))
    }

    // At least one of the advanced features should be used, or it's a basic generation
    const hasVoiceRef = !!voice_id || !!voice_file
    const hasInstrumentalRef = !!instrumental_file || !!instrumental_id
    const hasSongRef = !!song_file

    console.log('🎵 MiniMax Music-01 Generation Request:')
    console.log('  Title:', title)
    console.log('  Prompt:', prompt)
    console.log('  Voice ID:', voice_id || 'none')
    console.log('  Voice File:', voice_file ? 'provided' : 'none')
    console.log('  Song File:', song_file ? 'provided' : 'none')
    console.log('  Instrumental File:', instrumental_file ? 'provided' : 'none')
    console.log('  Instrumental ID:', instrumental_id || 'none')

    // Prepare lyrics
    let formattedLyrics: string
    if (!lyrics || typeof lyrics !== 'string' || lyrics.trim().length === 0) {
      console.log('⚡ No custom lyrics, using smart lyrics matcher')
      const matchedSong = findBestMatchingLyrics(prompt)
      formattedLyrics = expandLyricsForDuration(matchedSong.lyrics, duration as 'short' | 'medium' | 'long')
    } else {
      formattedLyrics = expandLyricsForDuration(lyrics.trim(), duration as 'short' | 'medium' | 'long')
    }

    // MiniMax 01 max lyrics is 350-400 chars
    if (formattedLyrics.length > 400) {
      formattedLyrics = formattedLyrics.substring(0, 397) + '...'
    }

    console.log('  Lyrics length:', formattedLyrics.length)

    // Check credits (music-01 costs 3 credits)
    const COST = 3
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,free_credits`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const users = await userRes.json()
    if (!users || users.length === 0) {
      return corsResponse(NextResponse.json({ error: 'User not found' }, { status: 404 }))
    }
    const userCredits = (users[0].credits || 0) + (users[0].free_credits || 0)
    if (userCredits < COST) {
      return corsResponse(NextResponse.json({
        error: `Insufficient credits. MiniMax 01 generation requires ${COST} credits.`,
        creditsNeeded: COST,
        creditsAvailable: userCredits
      }, { status: 402 }))
    }

    // Deduct credits atomically
    const deductRes = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_clerk_user_id: userId, p_amount: COST })
    })
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) {
      const raw = await deductRes.json()
      deductResult = Array.isArray(raw) ? raw[0] ?? null : raw
    }
    if (!deductRes.ok || !deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      console.error('❌ Credit deduction blocked:', errorMsg)
      await logCreditTransaction({ userId, amount: -COST, type: 'generation_music', status: 'failed', description: `Music-01: ${title}`, metadata: { prompt, genre } })
      return corsResponse(NextResponse.json({ error: errorMsg }, { status: 402 }))
    }
    console.log(`✅ Credits deducted (${COST}). Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId, amount: -COST, balanceAfter: deductResult.new_credits, type: 'generation_music', description: `Music-01: ${title}`, metadata: { prompt, genre, voice_id, hasVoiceRef, hasInstrumentalRef, hasSongRef } })

    // Use NDJSON streaming (same as music-only)
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    let clientDisconnected = false
    const requestSignal = req.signal

    const sendLine = async (data: Record<string, unknown>) => {
      if (clientDisconnected) return
      try {
        await writer.write(encoder.encode(JSON.stringify(data) + '\n'))
      } catch {
        clientDisconnected = true
      }
    }

    ;(async () => {
      try {
        // Build input for minimax/music-01
        const modelInput: Record<string, unknown> = {
          lyrics: formattedLyrics,
          sample_rate,
          bitrate,
        }

        // Add optional reference files
        if (voice_id) modelInput.voice_id = voice_id
        if (voice_file) modelInput.voice_file = voice_file
        if (song_file) modelInput.song_file = song_file
        if (instrumental_file) modelInput.instrumental_file = instrumental_file
        if (instrumental_id) modelInput.instrumental_id = instrumental_id

        console.log('🎵 Creating minimax/music-01 prediction with input:', JSON.stringify(modelInput, null, 2))

        const prediction = await replicate.predictions.create({
          model: 'minimax/music-01',
          input: modelInput
        })

        console.log('🎵 Music-01 prediction created:', prediction.id)
        await sendLine({ type: 'started', predictionId: prediction.id })

        // Poll until done
        let finalPrediction = prediction
        let attempts = 0
        const maxAttempts = 150 // 300s

        while (
          finalPrediction.status !== 'succeeded' &&
          finalPrediction.status !== 'failed' &&
          finalPrediction.status !== 'canceled' &&
          attempts < maxAttempts
        ) {
          if (requestSignal.aborted && !clientDisconnected) {
            console.log('🔄 Client disconnected but continuing music-01 generation:', prediction.id)
            clientDisconnected = true
          }
          await new Promise(resolve => setTimeout(resolve, 2000))
          finalPrediction = await replicate.predictions.get(prediction.id)
          attempts++
        }

        if (finalPrediction.status === 'canceled') {
          console.log('⏹ Music-01 prediction cancelled:', prediction.id)
          await refundCredits({ userId, amount: COST, type: 'generation_music', reason: `Cancelled: ${title}`, metadata: { prompt, genre } })
          notifyGenerationFailed(userId, 'music', 'Generation cancelled — credits refunded').catch(() => {})
          await sendLine({ type: 'result', success: false, error: 'Generation cancelled', creditsRemaining: deductResult!.new_credits })
          await writer.close().catch(() => {})
          return
        }

        if (finalPrediction.status !== 'succeeded') {
          const errMsg = finalPrediction.error || `Generation ${finalPrediction.status === 'failed' ? 'failed' : 'timed out'}`
          console.error('❌ Music-01 failed:', errMsg)
          await refundCredits({ userId, amount: COST, type: 'generation_music', reason: `Failed: ${title}`, metadata: { prompt, genre, error: String(errMsg).substring(0, 200) } })
          notifyGenerationFailed(userId, 'music', 'Generation failed — credits refunded').catch(() => {})
          await sendLine({ type: 'result', success: false, error: sanitizeError(errMsg), creditsRemaining: deductResult!.new_credits })
          await writer.close().catch(() => {})
          return
        }

        console.log('✅ Music-01 generation succeeded!')
        const output = finalPrediction.output

        // Extract audio URL from output (FileOutput with .url() method or string)
        let audioUrl: string
        if (typeof output === 'string') {
          audioUrl = output
        } else if (output && typeof (output as any).url === 'function') {
          audioUrl = (output as any).url()
        } else if (output && typeof output === 'object' && 'url' in output) {
          audioUrl = (output as any).url
        } else {
          console.error('❌ Unexpected music-01 output format:', output)
          throw new Error('Invalid output from API')
        }

        console.log('🎵 Audio URL:', audioUrl)

        // Upload to R2
        console.log('📦 Uploading to R2...')
        const fileName = `${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-m01-${Date.now()}.wav`
        const r2Result = await downloadAndUploadToR2(audioUrl, userId, 'music', fileName)
        if (!r2Result.success) {
          throw new Error(`R2 upload failed: ${r2Result.error}`)
        }
        audioUrl = r2Result.url
        console.log('✅ R2 upload:', audioUrl)

        // Save to music_library
        console.log('💾 Saving to music library...')
        const libraryEntry = {
          clerk_user_id: userId,
          title,
          prompt,
          lyrics: formattedLyrics,
          audio_url: audioUrl,
          audio_format: 'wav',
          bitrate,
          sample_rate,
          generation_params: {
            model: 'minimax/music-01',
            bitrate,
            sample_rate,
            voice_id: voice_id || undefined,
            has_voice_ref: !!voice_file,
            has_instrumental_ref: !!instrumental_file,
            has_song_ref: !!song_file,
          },
          status: 'ready'
        }

        const saveResponse = await fetch(`${supabaseUrl}/rest/v1/music_library`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
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
            metadata: JSON.stringify({ source: 'music-01', model: 'minimax/music-01', voice_id: voice_id || undefined, has_voice_ref: !!voice_file, has_instrumental_ref: !!instrumental_file })
          }
          const combinedRes = await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
            method: 'POST',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation'
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

        // Quest progress (fire-and-forget)
        const { trackQuestProgress, trackModelUsage, trackGenerationStreak } = await import('@/lib/quest-progress')
        trackQuestProgress(userId, 'generate_songs').catch(() => {})
        if (genre) trackQuestProgress(userId, 'use_genres', 1, genre).catch(() => {})
        trackModelUsage(userId, 'minimax-music-01').catch(() => {})
        trackGenerationStreak(userId).catch(() => {})

        // ── VOICE ROYALTY: award 1 credit to the voice owner if using a listed voice ──
        if (voice_id) {
          try {
            // Check if this voice_id is listed on the marketplace
            const listingRes = await fetch(
              `${supabaseUrl}/rest/v1/voice_listings?voice_id=eq.${encodeURIComponent(voice_id)}&is_active=eq.true&select=id,clerk_user_id`,
              { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
            )
            const listings = await listingRes.json()
            if (listings && listings.length > 0) {
              const listing = listings[0]
              const voiceOwnerId = listing.clerk_user_id
              // Don't award royalty to self
              if (voiceOwnerId && voiceOwnerId !== userId) {
                const ROYALTY_AMOUNT = 1
                // Award 1 credit to voice owner
                await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
                  method: 'POST',
                  headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ p_clerk_user_id: voiceOwnerId, p_amount: -ROYALTY_AMOUNT }) // negative = add credits
                })
                // Record royalty
                await fetch(`${supabaseUrl}/rest/v1/voice_royalties`, {
                  method: 'POST',
                  headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    voice_listing_id: listing.id,
                    voice_owner_id: voiceOwnerId,
                    generator_user_id: userId,
                    credits_earned: ROYALTY_AMOUNT,
                    generation_type: 'music-01',
                  })
                })
                // Increment total_uses and total_royalties_earned on listing
                await fetch(`${supabaseUrl}/rest/v1/voice_listings?id=eq.${listing.id}`, {
                  method: 'PATCH',
                  headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    total_uses: (listing.total_uses || 0) + 1,
                    total_royalties_earned: (listing.total_royalties_earned || 0) + ROYALTY_AMOUNT,
                    updated_at: new Date().toISOString(),
                  })
                })
                // Log credit transaction for the voice owner
                await logCreditTransaction({
                  userId: voiceOwnerId,
                  amount: ROYALTY_AMOUNT,
                  type: 'earn_sale',
                  description: `Voice royalty: "${title}" used your Voice ID`,
                  metadata: { voice_id, generator_user_id: userId, listing_id: listing.id }
                })
                console.log(`💰 Voice royalty: ${ROYALTY_AMOUNT} credit awarded to ${voiceOwnerId}`)
              }
            }
          } catch (royaltyErr) {
            console.error('⚠️ Voice royalty processing failed (non-critical):', royaltyErr)
          }
        }

        // Update transaction with output
        updateTransactionMedia({ userId, type: 'generation_music', mediaUrl: audioUrl, mediaType: 'audio', title, extraMeta: { genre, model: 'music-01' } }).catch(() => {})

        // Notify user of successful generation
        notifyGenerationComplete(userId, libraryId || '', 'music', title).catch(() => {})
        notifyCreditDeduct(userId, COST, `Music-01 generation: ${title}`).catch(() => {})

        const response: Record<string, unknown> = {
          type: 'result',
          success: true,
          audioUrl,
          title,
          lyrics: formattedLyrics,
          libraryId,
          creditsRemaining: deductResult!.new_credits,
          creditsDeducted: COST
        }

        if (clientDisconnected) {
          console.log('✅ Music-01 completed in background:', title)
        }

        await sendLine(response)
        await writer.close().catch(() => {})

      } catch (error) {
        console.error('❌ Music-01 generation error (stream):', error)
        await refundCredits({ userId, amount: COST, type: 'generation_music', reason: `Error: ${String(error).substring(0, 80)}`, metadata: { prompt, genre, error: String(error).substring(0, 200) } })
        notifyGenerationFailed(userId, 'music', 'Generation error — credits refunded').catch(() => {})
        try {
          await sendLine({ type: 'result', success: false, error: sanitizeError(error) })
          await writer.close()
        } catch { /* stream closed */ }
      }
    })()

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked'
      }
    })

  } catch (error) {
    console.error('❌ Music-01 generation error:', error)
    return corsResponse(NextResponse.json({
      success: false,
      error: sanitizeError(error),
    }, { status: 500 }))
  }
}
