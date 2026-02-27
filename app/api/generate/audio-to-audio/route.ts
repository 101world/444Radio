import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'

// Allow up to 5 minutes for fal.ai generation
export const maxDuration = 300

const FAL_MODEL = 'fal-ai/stable-audio-25/audio-to-audio'

/** Call fal.ai synchronously (blocks until generation complete) */
async function runFalAi(falKey: string, input: Record<string, unknown>): Promise<{ data: any }> {
  console.log('🔁 Calling fal.ai synchronous endpoint...')
  const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`fal.ai request failed (${res.status}): ${body}`)
  }
  const data = await res.json()
  console.log('🔁 fal.ai response received')
  return { data }
}

function sanitizeError(error: any): string {
  const errorStr = error instanceof Error ? error.message : String(error)
  if (errorStr.includes('429') || errorStr.includes('rate limit') || errorStr.includes('fal') ||
      errorStr.includes('supabase') || errorStr.includes('API') || errorStr.includes('failed with')) {
    return '444 radio is locking in, please try again in a few minutes'
  }
  return '444 radio is locking in, please try again in a few minutes'
}

/**
 * POST /api/generate/audio-to-audio
 *
 * Uses fal-ai/stable-audio-25/audio-to-audio for audio-to-audio remix.
 * Same engine as /api/generate/resound — both are "444 Radio Remix".
 * Costs 10 credits. Returns NDJSON synchronously (no detached IIFE).
 */
export async function POST(req: NextRequest) {
  const ndjsonLines: string[] = []
  const addLine = (data: Record<string, unknown>) => ndjsonLines.push(JSON.stringify(data))

  try {
    const falKey = process.env.FAL_KEY || process.env.fal_key
    console.warn('🔑 FAL_KEY present:', !!falKey, 'length:', falKey?.length || 0)
    if (!falKey) {
      console.error('❌ FAL_KEY environment variable is not set!')
      return NextResponse.json({ error: 'Server configuration error: FAL_KEY missing' }, { status: 500 })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { title, prompt, audio_url, strength, num_inference_steps, total_seconds, guidance_scale, seed } = await req.json()

    if (!title || typeof title !== 'string' || title.trim().length < 1 || title.trim().length > 100)
      return NextResponse.json({ error: 'Title is required (1-100 characters)' }, { status: 400 })
    if (!prompt || prompt.length < 3 || prompt.length > 500)
      return NextResponse.json({ error: 'Prompt is required (3-500 characters)' }, { status: 400 })
    if (!audio_url)
      return NextResponse.json({ error: 'An input audio URL is required' }, { status: 400 })

    console.log('🔁 Audio-to-Audio —', title, '|', prompt, '| strength:', strength)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,free_credits`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const users = await userRes.json()
    if (!users?.length) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const totalCredits = (users[0].credits || 0) + (users[0].free_credits || 0)
    if (totalCredits < 10) return NextResponse.json({ error: 'Insufficient credits. Remix requires 10 credits.', creditsNeeded: 10, creditsAvailable: totalCredits }, { status: 402 })

    const deductRes = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_clerk_user_id: userId, p_amount: 10 }),
    })
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) { const raw = await deductRes.json(); deductResult = Array.isArray(raw) ? raw[0] ?? null : raw }
    if (!deductRes.ok || !deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      await logCreditTransaction({ userId, amount: -10, type: 'generation_music', status: 'failed', description: `Audio-to-Audio: ${title}`, metadata: { prompt, model: 'fal-stable-audio-25' } })
      return NextResponse.json({ error: errorMsg }, { status: 402 })
    }
    console.log(`✅ Credits deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId, amount: -10, balanceAfter: deductResult.new_credits, type: 'generation_music', description: `Audio-to-Audio: ${title}`, metadata: { prompt, model: 'fal-stable-audio-25' } })

    addLine({ type: 'started', model: 'fal-stable-audio-25' })

    try {
      const falInput: Record<string, unknown> = {
        prompt: prompt.trim(),
        audio_url,
        strength: typeof strength === 'number' ? strength : 0.8,
        num_inference_steps: typeof num_inference_steps === 'number' ? num_inference_steps : 8,
        guidance_scale: typeof guidance_scale === 'number' ? guidance_scale : 1,
      }
      if (typeof total_seconds === 'number' && total_seconds > 0) falInput.total_seconds = total_seconds
      if (typeof seed === 'number' && seed >= 0) falInput.seed = seed

      console.log('🔁 fal.ai input:', JSON.stringify(falInput))

      const result = await runFalAi(falKey, falInput)
      console.log('🔁 fal.ai done')

      const audioData = result.data?.audio
      let audioUrl: string
      if (typeof audioData === 'string') audioUrl = audioData
      else if (audioData?.url) audioUrl = audioData.url
      else throw new Error('No audio URL in fal.ai output')

      const resultSeed = result.data?.seed
      console.log('🔁 fal.ai audio:', audioUrl, 'seed:', resultSeed)

      const fileName = `a2a-${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.wav`
      const r2Result = await downloadAndUploadToR2(audioUrl, userId, 'music', fileName)
      if (!r2Result.success) throw new Error(`R2 upload failed: ${r2Result.error}`)
      audioUrl = r2Result.url
      console.log('✅ R2:', audioUrl)

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
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(libraryEntry),
      })
      let savedMusic: any = null
      if (saveRes.ok) { const d = await saveRes.json(); savedMusic = Array.isArray(d) ? d[0] : d; console.log('✅ Library:', savedMusic?.title) }
      else console.error('❌ Library save failed:', saveRes.status, await saveRes.text().catch(() => ''))

      import('@/lib/quest-progress').then(({ trackQuestProgress, trackModelUsage, trackGenerationStreak }) => {
        trackQuestProgress(userId, 'generate_songs').catch(() => {})
        trackModelUsage(userId, 'fal-stable-audio-25').catch(() => {})
        trackGenerationStreak(userId).catch(() => {})
      }).catch(() => {})
      updateTransactionMedia({ userId, type: 'generation_music', mediaUrl: audioUrl, mediaType: 'audio', title, extraMeta: { model: 'fal-stable-audio-25' } }).catch(() => {})

      addLine({
        type: 'result',
        success: true,
        audioUrl,
        title: title.trim(),
        libraryId: savedMusic?.id || null,
        creditsRemaining: deductResult.new_credits,
        creditsDeducted: 10,
        seed: resultSeed,
      })
    } catch (genErr: any) {
      console.error('❌ Audio-to-Audio error:', genErr?.message || genErr, genErr?.stack?.substring(0, 300))
      await refundCredits({ userId, amount: 10, type: 'generation_music', reason: `Audio-to-Audio error: ${title}`, metadata: { prompt, model: 'fal-stable-audio-25', error: String(genErr).substring(0, 200) } })
      addLine({ type: 'result', success: false, error: sanitizeError(genErr), creditsRemaining: deductResult.new_credits })
    }

    return new Response(ndjsonLines.join('\n') + '\n', {
      headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' },
    })
  } catch (error: any) {
    console.error('Audio-to-Audio OUTER error:', error?.message || error, error?.stack?.substring(0, 500))
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 })
  }
}
