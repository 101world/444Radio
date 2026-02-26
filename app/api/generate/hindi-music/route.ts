import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { notifyGenerationComplete, notifyGenerationFailed, notifyCreditDeduct } from '@/lib/notifications'

// Allow up to 5 minutes for fal.ai MiniMax 2.0 generation
export const maxDuration = 300

const CREDIT_COST = 2
const FAL_MODEL = 'fal-ai/minimax-music/v2'

/**
 * Call fal.ai synchronous endpoint — blocks until generation completes.
 * MiniMax 2.0 typically takes 30-120s, well within our 300s Vercel timeout.
 * Uses fal.run (synchronous) instead of queue.fal.run (queue + poll).
 */
async function runMiniMax2(
  falKey: string,
  input: Record<string, unknown>,
): Promise<{ data: any }> {
  console.log('🎵 [MiniMax2] Calling fal.ai synchronous endpoint...')
  console.log('🎵 [MiniMax2] Model:', FAL_MODEL)
  console.log('🎵 [MiniMax2] Input keys:', Object.keys(input))
  console.log('🎵 [MiniMax2] Input:', JSON.stringify(input).substring(0, 500))

  const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('🎵 [MiniMax2] Request failed:', res.status, body.substring(0, 500))
    throw new Error(`MiniMax2 request failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  console.log('🎵 [MiniMax2] Response received, keys:', Object.keys(data || {}))
  return { data }
}

function sanitizeError(error: any): string {
  const errorStr = error instanceof Error ? error.message : String(error)
  if (
    errorStr.includes('429') || errorStr.includes('rate limit') ||
    errorStr.includes('fal') || errorStr.includes('supabase') ||
    errorStr.includes('API') || errorStr.includes('failed with') ||
    errorStr.includes('MiniMax')
  ) {
    return '444 radio is locking in, please try again in a few minutes'
  }
  return '444 radio is locking in, please try again in a few minutes'
}

/**
 * POST /api/generate/hindi-music
 *
 * Generates Hindi/Urdu/South-Asian music via fal.ai MiniMax Music 2.0.
 * Costs 2 credits. Returns NDJSON stream.
 *
 * Body: { title, prompt, lyrics, genre, bpm, audio_format? }
 *
 * audio_format: 'mp3' (default) | 'wav'
 */
export async function POST(req: NextRequest) {
  console.log('🎵 [HINDI-MUSIC] Route hit! POST /api/generate/hindi-music')
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ---------- FAL_KEY ----------
    const falKey = process.env.FAL_KEY || process.env.fal_key
    if (!falKey) {
      console.error('❌ FAL_KEY environment variable is not set!')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const {
      title,
      prompt,
      lyrics,
      genre,
      bpm,
      audio_format = 'mp3',
      generateCoverArt = false,
      source = 'hindi',
    } = await req.json()

    // Label for logging — 'pro' for Pro Mode, 'hindi' for South Asian languages
    const sourceLabel = source === 'pro' ? 'Pro Music' : 'Hindi Music'
    const sourceTag = source === 'pro' ? 'pro' : 'hindi'

    // Validate
    if (!title || typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 100) {
      return NextResponse.json({ error: 'Title required (3-100 characters)' }, { status: 400 })
    }
    if (!prompt || prompt.length < 10) {
      return NextResponse.json({ error: 'Prompt required (at least 10 characters)' }, { status: 400 })
    }

    // MiniMax V2 supports: mp3, pcm, flac (no wav — flac is lossless alternative)
    const chosenFormat = (audio_format === 'wav' || audio_format === 'flac') ? 'flac' : 'mp3'

    console.log(`🎵 [${sourceLabel}] MiniMax 2.0 generation request:`)
    console.log('  Title:', title)
    console.log('  Source:', source)
    console.log('  Prompt:', prompt)
    console.log('  Lyrics:', lyrics ? lyrics.substring(0, 100) + '...' : '<instrumental>')
    console.log('  Genre:', genre || 'auto')
    console.log('  BPM:', bpm || 'auto')
    console.log('  Format:', chosenFormat)

    // ---------- Credit check & deduction ----------
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const users = await userRes.json()
    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const userCredits = users[0].credits || 0
    if (userCredits < CREDIT_COST) {
      return NextResponse.json({
        error: `Insufficient credits. Music generation requires ${CREDIT_COST} credits.`,
        creditsNeeded: CREDIT_COST,
        creditsAvailable: userCredits,
      }, { status: 402 })
    }
    console.log(`💰 User has ${userCredits} credits. ${sourceLabel} requires ${CREDIT_COST}.`)

    // Deduct atomically
    const deductRes = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_clerk_user_id: userId, p_amount: CREDIT_COST }),
    })
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) {
      const raw = await deductRes.json()
      deductResult = Array.isArray(raw) ? raw[0] ?? null : raw
    }
    if (!deductRes.ok || !deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      console.error('❌ Credit deduction blocked:', errorMsg)
      await logCreditTransaction({ userId, amount: -CREDIT_COST, type: 'generation_music', status: 'failed', description: `${sourceLabel}: ${title}`, metadata: { prompt, genre, source: sourceTag } })
      return NextResponse.json({ error: errorMsg }, { status: 402 })
    }
    console.log(`✅ Credits deducted (${CREDIT_COST}). Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId, amount: -CREDIT_COST, balanceAfter: deductResult.new_credits, type: 'generation_music', description: `${sourceLabel}: ${title}`, metadata: { prompt, genre, model: 'minimax-music-02', source: sourceTag } })

    // ---------- Build MiniMax 2.0 input (fal.ai V2 schema) ----------
    const minimax2Input: Record<string, unknown> = {
      prompt: prompt.trim().substring(0, 200),
      audio_setting: {
        sample_rate: 44100,
        bitrate: 256000,
        format: chosenFormat,
      },
    }

    // MiniMax V2 uses lyrics_prompt (10-3000 chars) — omit entirely for instrumental
    if (lyrics && typeof lyrics === 'string' && lyrics.trim().length > 0 &&
        !lyrics.toLowerCase().includes('[instrumental]')) {
      minimax2Input.lyrics_prompt = lyrics.trim().substring(0, 3000)
    }

    console.log('🎵 [MiniMax2] Input:', JSON.stringify(minimax2Input, null, 2))

    // ---------- NDJSON stream ----------
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

        const { data } = await runMiniMax2(falKey, minimax2Input)

        if (requestSignal.aborted && !clientDisconnected) {
          console.log('🔄 Client disconnected but continuing Hindi gen')
          clientDisconnected = true
        }

        console.log('🎵 [MiniMax2] Raw output keys:', Object.keys(data || {}))
        console.log('🎵 [MiniMax2] Raw output:', JSON.stringify(data).substring(0, 500))

        // MiniMax V2 returns { audio: { url, content_type, file_name, file_size } }
        let audioUrl: string | undefined
        if (data?.audio?.url) {
          audioUrl = data.audio.url
        } else if (data?.audio && typeof data.audio === 'string') {
          audioUrl = data.audio
        } else if (typeof data?.output === 'string') {
          audioUrl = data.output
        }
        if (!audioUrl) {
          console.error('❌ [MiniMax2] Unexpected output format:', JSON.stringify(data).substring(0, 500))
          throw new Error('No audio in MiniMax 2.0 output')
        }

        console.log('🎵 [MiniMax2] Audio URL:', audioUrl)

        // Upload to R2 for permanent storage
        const ext = chosenFormat === 'flac' ? 'flac' : 'mp3'
        const filePrefix = sourceTag === 'pro' ? 'pro' : 'hindi'
        const fileName = `${filePrefix}-${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.${ext}`
        const r2Result = await downloadAndUploadToR2(audioUrl, userId, 'music', fileName)
        if (!r2Result.success) {
          throw new Error(`Failed to upload to permanent storage: ${r2Result.error}`)
        }
        audioUrl = r2Result.url
        console.log('✅ R2 upload successful:', audioUrl)

        // Save to music_library
        const libraryEntry = {
          clerk_user_id: userId,
          title,
          prompt,
          lyrics: lyrics || '',
          audio_url: audioUrl,
          audio_format: chosenFormat,
          bitrate: chosenFormat === 'mp3' ? 256000 : 0,
          sample_rate: 44100,
          generation_params: { model: 'minimax-music-02', language: sourceTag === 'pro' ? 'english' : 'hindi', source: sourceTag, audio_format: chosenFormat },
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
        } else {
          console.error('❌ music_library save failed:', saveRes.status, await saveRes.text().catch(() => ''))
        }

        // Also save to combined_media
        let savedCombined: any = null
        try {
          const combinedRes = await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
            method: 'POST',
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
            body: JSON.stringify({
              user_id: userId,
              type: 'audio',
              title,
              audio_prompt: prompt,
              lyrics: lyrics || '',
              audio_url: audioUrl,
              image_url: null,
              is_public: false,
              genre: genre || null,
              metadata: JSON.stringify({ source: sourceTag === 'pro' ? 'pro-music' : 'hindi-music', model: 'minimax-music-02', language: sourceTag === 'pro' ? 'english' : 'hindi', audio_format: chosenFormat }),
            }),
          })
          if (combinedRes.ok) {
            const d = await combinedRes.json()
            savedCombined = Array.isArray(d) ? d[0] : d
            console.log('✅ Saved to combined_media:', savedCombined?.id)
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
        notifyCreditDeduct(userId, CREDIT_COST, `${sourceLabel}: ${title}`).catch(() => {})

        const response: Record<string, unknown> = {
          type: 'result',
          success: true,
          audioUrl,
          title,
          lyrics: lyrics || '',
          libraryId,
          creditsRemaining: deductResult!.new_credits,
          creditsDeducted: CREDIT_COST,
        }

        // Optional cover art
        if (generateCoverArt && deductResult!.new_credits >= 1) {
          try {
            const Replicate = (await import('replicate')).default
            const replicate = new Replicate({ auth: process.env.REPLICATE_API_KEY_LATEST2! })
            const imagePrompt = `${prompt} music album cover art, ${genre || 'bollywood'} style, professional music artwork, vibrant colors`
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
                await fetch(`${supabaseUrl}/rest/v1/images_library`, {
                  method: 'POST',
                  headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
                  body: JSON.stringify({ user_id: userId, image_url: imageR2.url, prompt: imagePrompt, created_at: new Date().toISOString() }),
                })
                await logCreditTransaction({ userId, amount: -1, balanceAfter: deductResult!.new_credits - 1, type: 'generation_cover_art', description: `Cover art: ${title}`, metadata: { prompt: imagePrompt } })
              }
            }
          } catch (imgErr) {
            console.error('❌ Cover art error:', imgErr)
          }
        }

        if (clientDisconnected) {
          console.log('✅ Hindi gen completed in background:', title)
        }

        await sendLine(response)
        await writer.close().catch(() => {})
      } catch (error) {
        console.error('❌ Hindi music generation error:', error)
        await refundCredits({ userId, amount: CREDIT_COST, type: 'generation_music', reason: `Error: ${String(error).substring(0, 80)}`, metadata: { prompt, genre, source: sourceTag, error: String(error).substring(0, 200) } })
        notifyGenerationFailed(userId, 'music', `${sourceLabel} generation error — credits refunded`).catch(() => {})
        try {
          await sendLine({ type: 'result', success: false, error: sanitizeError(error) })
          await writer.close()
        } catch { /* stream may already be closed */ }
      }
    })()

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('❌ Hindi music generation error:', error)
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 })
  }
}
