import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'

// Allow up to 5 minutes for MusicGen generation
export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

function sanitizeError(error: any): string {
  const errorStr = error instanceof Error ? error.message : String(error)
  if (
    errorStr.includes('429') ||
    errorStr.includes('rate limit') ||
    errorStr.includes('replicate') ||
    errorStr.includes('supabase') ||
    errorStr.includes('API') ||
    errorStr.includes('prediction') ||
    errorStr.includes('failed with')
  ) {
    return '444 radio is locking in, please try again in a few minutes'
  }
  return '444 radio is locking in, please try again in a few minutes'
}

/**
 * POST /api/generate/resound
 *
 * Uses meta/musicgen on Replicate to generate instrumental music from an uploaded beat
 * and a text prompt (Remix). All MusicGen parameters are exposed.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      title,
      prompt,
      input_audio,      // Public URL of the uploaded beat
      duration,          // integer seconds
      continuation,      // boolean
      continuation_start,// integer
      continuation_end,  // integer | null
      model_version,     // string enum
      output_format,     // wav | mp3
      normalization_strategy, // peak | loudness | clip | rms
      top_k,             // integer
      top_p,             // number 0-1
      temperature,       // number
      classifier_free_guidance, // integer
      multi_band_diffusion,     // boolean
      seed,              // integer | null
    } = await req.json()

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length < 1 || title.trim().length > 100) {
      return NextResponse.json({ error: 'Title is required (1-100 characters)' }, { status: 400 })
    }
    if (!prompt || prompt.length < 3 || prompt.length > 500) {
      return NextResponse.json({ error: 'Prompt is required (3-500 characters)' }, { status: 400 })
    }
    if (!input_audio) {
      return NextResponse.json({ error: 'An input audio file URL is required' }, { status: 400 })
    }

    console.log('🔁 Remix Generation Parameters:')
    console.log('  Title:', title)
    console.log('  Prompt:', prompt)
    console.log('  Input audio:', input_audio)
    console.log('  Duration:', duration)
    console.log('  Model version:', model_version)
    console.log('  Output format:', output_format)

    // ----- Credit check & deduction (2 credits) -----
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
    if (userCredits < 10) {
      return NextResponse.json({
        error: 'Insufficient credits. Remix requires 10 credits.',
        creditsNeeded: 10,
        creditsAvailable: userCredits,
      }, { status: 402 })
    }

    const deductRes = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_clerk_user_id: userId, p_amount: 10 }),
    })
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) {
      const raw = await deductRes.json()
      deductResult = Array.isArray(raw) ? raw[0] ?? null : raw
    }
    if (!deductRes.ok || !deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      console.error('❌ Credit deduction blocked:', errorMsg)
      await logCreditTransaction({ userId, amount: -10, type: 'generation_resound', status: 'failed', description: `Remix: ${title}`, metadata: { prompt } })
      return NextResponse.json({ error: errorMsg }, { status: 402 })
    }
    console.log(`✅ Credits deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId, amount: -10, balanceAfter: deductResult.new_credits, type: 'generation_resound', description: `Remix: ${title}`, metadata: { prompt } })

    // ----- NDJSON streaming response -----
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
        // Build MusicGen input — include every parameter
        const musicgenInput: Record<string, unknown> = {
          prompt: prompt.trim(),
          model_version: model_version || 'stereo-melody-large',
          output_format: output_format || 'wav',
          normalization_strategy: normalization_strategy || 'peak',
          duration: typeof duration === 'number' ? duration : 8,
          top_k: typeof top_k === 'number' ? top_k : 250,
          top_p: typeof top_p === 'number' ? top_p : 0,
          temperature: typeof temperature === 'number' ? temperature : 1,
          classifier_free_guidance: typeof classifier_free_guidance === 'number' ? classifier_free_guidance : 3,
          continuation: typeof continuation === 'boolean' ? continuation : true,
          multi_band_diffusion: typeof multi_band_diffusion === 'boolean' ? multi_band_diffusion : false,
        }

        // Attach the uploaded beat as input_audio
        if (input_audio) {
          musicgenInput.input_audio = input_audio
        }

        // Optional continuation start/end
        if (typeof continuation_start === 'number') {
          musicgenInput.continuation_start = continuation_start
        }
        if (typeof continuation_end === 'number' && continuation_end > 0) {
          musicgenInput.continuation_end = continuation_end
        }

        // Optional seed
        if (typeof seed === 'number' && seed >= 0) {
          musicgenInput.seed = seed
        }

        console.log('🔁 Creating MusicGen prediction with input:', JSON.stringify(musicgenInput, null, 2))

        const prediction = await replicate.predictions.create({
          version: '671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb',
          input: musicgenInput,
        })

        console.log('🔁 MusicGen prediction created:', prediction.id)
        await sendLine({ type: 'started', predictionId: prediction.id })

        // Poll until complete
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
            console.log('🔄 Client disconnected but continuing generation:', prediction.id)
            clientDisconnected = true
          }
          await new Promise(resolve => setTimeout(resolve, 2000))
          finalPrediction = await replicate.predictions.get(prediction.id)
          attempts++
        }

        if (finalPrediction.status === 'canceled') {
          console.log('⏹ Remix prediction cancelled:', prediction.id)
          await refundCredits({ userId, amount: 10, type: 'generation_resound', reason: `Cancelled: ${title}`, metadata: { prompt, reason: 'user_cancelled' } })
          await sendLine({ type: 'result', success: false, error: 'Generation cancelled', creditsRemaining: deductResult!.new_credits })
          await writer.close().catch(() => {})
          return
        }

        if (finalPrediction.status !== 'succeeded') {
          const errMsg = finalPrediction.error || `Generation ${finalPrediction.status === 'failed' ? 'failed' : 'timed out'}`
          console.error('❌ Remix prediction failed:', errMsg)
          await refundCredits({ userId, amount: 10, type: 'generation_resound', reason: `Failed: ${title}`, metadata: { prompt, error: String(errMsg).substring(0, 200) } })
          await sendLine({ type: 'result', success: false, error: sanitizeError(errMsg), creditsRemaining: deductResult!.new_credits })
          await writer.close().catch(() => {})
          return
        }

        // Extract audio URL from output
        const output = finalPrediction.output
        let audioUrl: string
        if (typeof output === 'string') {
          audioUrl = output
        } else if (output && typeof (output as any).url === 'function') {
          audioUrl = (output as any).url()
        } else if (output && typeof output === 'object' && 'url' in output) {
          audioUrl = (output as any).url
        } else {
          throw new Error('Invalid output format from MusicGen')
        }

        console.log('🔁 Remix MusicGen audio URL:', audioUrl)

        // Upload to R2
        const ext = (output_format || 'wav')
        const fileName = `remix-${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.${ext}`
        const r2Result = await downloadAndUploadToR2(audioUrl, userId, 'music', fileName)
        if (!r2Result.success) {
          throw new Error(`Failed to upload to permanent storage: ${r2Result.error}`)
        }
        audioUrl = r2Result.url
        console.log('✅ R2 upload:', audioUrl)

        // Save to music_library
        const libraryEntry = {
          clerk_user_id: userId,
          title: title.trim(),
          prompt,
          audio_url: audioUrl,
          audio_format: output_format || 'wav',
          generation_params: {
            model: 'meta/musicgen',
            model_version: model_version || 'stereo-melody-large',
            output_format: output_format || 'wav',
            duration,
            continuation,
            normalization_strategy: normalization_strategy || 'peak',
            top_k,
            top_p,
            temperature,
            classifier_free_guidance,
            multi_band_diffusion,
            seed,
            input_audio,
          },
          status: 'ready',
        }

        const saveRes = await fetch(`${supabaseUrl}/rest/v1/music_library`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(libraryEntry),
        })
        let savedMusic: any = null
        if (saveRes.ok) {
          const d = await saveRes.json()
          savedMusic = Array.isArray(d) ? d[0] : d
          console.log('✅ Saved to library:', savedMusic?.title)
        } else {
          console.error('❌ Failed to save to music_library:', saveRes.status)
        }

        // Quest progress
        const { trackQuestProgress, trackModelUsage, trackGenerationStreak } = await import('@/lib/quest-progress')
        trackQuestProgress(userId, 'generate_songs').catch(() => {})
        trackModelUsage(userId, 'musicgen').catch(() => {})
        trackGenerationStreak(userId).catch(() => {})

        updateTransactionMedia({ userId, type: 'generation_resound', mediaUrl: audioUrl, mediaType: 'audio', title, extraMeta: { model: 'musicgen' } }).catch(() => {})

        await sendLine({
          type: 'result',
          success: true,
          audioUrl,
          title: title.trim(),
          libraryId: savedMusic?.id || null,
          creditsRemaining: deductResult!.new_credits,
          creditsDeducted: 10,
        })
      } catch (err: any) {
        console.error('❌ Resound generation error:', err)
        await refundCredits({ userId, amount: 10, type: 'generation_resound', reason: `Error: ${title}`, metadata: { prompt, error: String(err).substring(0, 200) } })
        await sendLine({ type: 'result', success: false, error: sanitizeError(err), creditsRemaining: deductResult!.new_credits })
      } finally {
        await writer.close().catch(() => {})
      }
    })()

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error: any) {
    console.error('Remix generation error:', error)
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 })
  }
}
