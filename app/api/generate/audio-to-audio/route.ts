import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'

// Allow up to 5 minutes for fal.ai generation
export const maxDuration = 300

const FAL_MODEL = 'fal-ai/stable-audio-25/audio-to-audio'

/** Submit a request to the fal.ai queue and poll until complete */
async function runFalAi(falKey: string, input: Record<string, unknown>): Promise<{ data: any; requestId: string }> {
  // 1. Submit to queue
  const queueRes = await fetch(`https://queue.fal.run/${FAL_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  if (!queueRes.ok) {
    const body = await queueRes.text()
    throw new Error(`fal.ai queue submit failed (${queueRes.status}): ${body}`)
  }
  const { request_id } = await queueRes.json()
  console.log('🔁 fal.ai request queued:', request_id)

  // 2. Poll for completion (max ~4.5 minutes)
  const maxPollMs = 270_000
  const startTime = Date.now()
  let pollInterval = 2_000

  while (Date.now() - startTime < maxPollMs) {
    await new Promise((r) => setTimeout(r, pollInterval))
    if (pollInterval < 10_000) pollInterval = Math.min(pollInterval + 1_000, 10_000)

    const statusRes = await fetch(
      `https://queue.fal.run/${FAL_MODEL}/requests/${request_id}/status`,
      { headers: { Authorization: `Key ${falKey}` } }
    )
    if (!statusRes.ok) {
      console.warn('⚠️ fal.ai status poll error:', statusRes.status)
      continue
    }
    const status = await statusRes.json()
    console.log('  fal.ai status:', status.status)

    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(
        `https://queue.fal.run/${FAL_MODEL}/requests/${request_id}`,
        { headers: { Authorization: `Key ${falKey}` } }
      )
      if (!resultRes.ok) {
        const errBody = await resultRes.text()
        throw new Error(`fal.ai result fetch failed (${resultRes.status}): ${errBody}`)
      }
      const data = await resultRes.json()
      return { data, requestId: request_id }
    }

    if (status.status === 'FAILED') {
      throw new Error(`fal.ai generation failed: ${JSON.stringify(status)}`)
    }
  }

  throw new Error('fal.ai generation timed out after polling')
}

function sanitizeError(error: any): string {
  const errorStr = error instanceof Error ? error.message : String(error)
  if (
    errorStr.includes('429') ||
    errorStr.includes('rate limit') ||
    errorStr.includes('fal') ||
    errorStr.includes('supabase') ||
    errorStr.includes('API') ||
    errorStr.includes('failed with')
  ) {
    return '444 radio is locking in, please try again in a few minutes'
  }
  return '444 radio is locking in, please try again in a few minutes'
}

/**
 * POST /api/generate/audio-to-audio
 *
 * Uses fal-ai/stable-audio-25/audio-to-audio for audio-to-audio remix.
 * Same engine as /api/generate/resound — both are "444 Radio Remix".
 * Accepts JSON body with all fal.ai parameters. Costs 10 credits.
 *
 * ⚠️  INSTRUMENTAL ONLY — prompts should describe instrumental music only.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify FAL_KEY at request time (accept either casing)
    const falKey = process.env.FAL_KEY || process.env.fal_key
    console.warn('🔑 FAL_KEY present:', !!falKey, 'length:', falKey?.length || 0)
    if (!falKey) {
      console.error('❌ FAL_KEY environment variable is not set!')
      return NextResponse.json({ error: 'Server configuration error: FAL_KEY missing' }, { status: 500 })
    }

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      title,
      prompt,
      audio_url,          // Public URL of the input audio
      strength,           // float 0-1, default 0.8
      num_inference_steps, // integer, default 8
      total_seconds,      // integer duration (null = auto from input)
      guidance_scale,     // integer, default 1
      seed,               // integer | null
    } = await req.json()

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length < 1 || title.trim().length > 100) {
      return NextResponse.json({ error: 'Title is required (1-100 characters)' }, { status: 400 })
    }
    if (!prompt || prompt.length < 3 || prompt.length > 500) {
      return NextResponse.json({ error: 'Prompt is required (3-500 characters)' }, { status: 400 })
    }
    if (!audio_url) {
      return NextResponse.json({ error: 'An input audio URL is required' }, { status: 400 })
    }

    console.log('🔁 444 Radio Audio-to-Audio Parameters:')
    console.log('  Title:', title)
    console.log('  Prompt:', prompt)
    console.log('  Audio URL:', audio_url)
    console.log('  Strength:', strength)
    console.log('  Steps:', num_inference_steps)
    console.log('  Duration:', total_seconds)
    console.log('  Guidance Scale:', guidance_scale)
    console.log('  Seed:', seed)

    // ----- Credit check & deduction (10 credits) -----
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
        error: 'Insufficient credits. 444 Radio Remix requires 10 credits.',
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
      await logCreditTransaction({ userId, amount: -10, type: 'generation_music', status: 'failed', description: `Audio-to-Audio: ${title}`, metadata: { prompt, model: 'fal-stable-audio-25' } })
      return NextResponse.json({ error: errorMsg }, { status: 402 })
    }
    console.log(`✅ Credits deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId, amount: -10, balanceAfter: deductResult.new_credits, type: 'generation_music', description: `Audio-to-Audio: ${title}`, metadata: { prompt, model: 'fal-stable-audio-25' } })

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

    ;(async () => {
      try {
        // Build fal.ai input with all parameters
        const falInput: Record<string, unknown> = {
          prompt: prompt.trim(),
          audio_url: audio_url,
          strength: typeof strength === 'number' ? strength : 0.8,
          num_inference_steps: typeof num_inference_steps === 'number' ? num_inference_steps : 8,
          guidance_scale: typeof guidance_scale === 'number' ? guidance_scale : 1,
        }

        if (typeof total_seconds === 'number' && total_seconds > 0) {
          falInput.total_seconds = total_seconds
        }

        if (typeof seed === 'number' && seed >= 0) {
          falInput.seed = seed
        }

        console.log('🔁 Calling fal.ai stable-audio-25/audio-to-audio:', JSON.stringify(falInput, null, 2))

        await sendLine({ type: 'started', model: 'fal-stable-audio-25' })

        // Use direct fetch to fal.ai REST queue API
        const result = await runFalAi(falKey, falInput)

        console.log('🔁 fal.ai result received:', result.requestId)

        const audioData = result.data?.audio
        let audioUrl: string
        if (typeof audioData === 'string') {
          audioUrl = audioData
        } else if (audioData && typeof audioData === 'object' && audioData.url) {
          audioUrl = audioData.url
        } else {
          throw new Error('Invalid output format from fal.ai — no audio URL returned')
        }

        const resultSeed = result.data?.seed

        console.log('🔁 fal.ai audio URL:', audioUrl)

        // Upload to R2
        const fileName = `a2a-${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.wav`
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
          audio_format: 'wav',
          generation_params: {
            model: 'fal-ai/stable-audio-25/audio-to-audio',
            strength: falInput.strength,
            num_inference_steps: falInput.num_inference_steps,
            total_seconds: falInput.total_seconds || null,
            guidance_scale: falInput.guidance_scale,
            seed: resultSeed || seed,
            input_audio_url: audio_url,
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
        trackModelUsage(userId, 'fal-stable-audio-25').catch(() => {})
        trackGenerationStreak(userId).catch(() => {})

        updateTransactionMedia({ userId, type: 'generation_music', mediaUrl: audioUrl, mediaType: 'audio', title, extraMeta: { model: 'fal-stable-audio-25' } }).catch(() => {})

        await sendLine({
          type: 'result',
          success: true,
          audioUrl,
          title: title.trim(),
          libraryId: savedMusic?.id || null,
          creditsRemaining: deductResult!.new_credits,
          creditsDeducted: 10,
          seed: resultSeed,
        })
      } catch (err: any) {
        console.error('❌ 444 Radio Audio-to-Audio error:', err)
        await refundCredits({ userId, amount: 10, type: 'generation_music', reason: `Audio-to-Audio error: ${title}`, metadata: { prompt, model: 'fal-stable-audio-25', error: String(err).substring(0, 200) } })
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
    console.error('Audio-to-audio error:', error)
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 })
  }
}
