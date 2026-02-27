import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { createNotification } from '@/lib/notifications'

// Allow up to 5 minutes for fal.ai generation
export const maxDuration = 300

const FAL_MODEL = 'CassetteAI/music-generator'

/** Call fal.ai synchronously (blocks until generation complete) */
async function runFalAi(falKey: string, input: Record<string, unknown>): Promise<{ data: any }> {
  console.log('🥁 Calling fal.ai Beat Maker endpoint...')
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
  console.log('🥁 fal.ai Beat Maker response received')
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
 * POST /api/generate/beatmaker
 *
 * Uses CassetteAI/music-generator via fal.ai to generate instrumentals & samples.
 * Branded as "Beat Maker". Costs 2 credits per 60 seconds of output.
 *
 * Input: { title, prompt, duration }
 * Returns NDJSON: { type: 'started' } then { type: 'result', success, ... }
 */
export async function POST(req: NextRequest) {
  const ndjsonLines: string[] = []
  const addLine = (data: Record<string, unknown>) => ndjsonLines.push(JSON.stringify(data))

  try {
    // ---------- FAL_KEY ----------
    const falKey = process.env.FAL_KEY || process.env.fal_key
    if (!falKey) {
      console.error('❌ FAL_KEY environment variable is not set!')
      return NextResponse.json({ error: 'Server configuration error: FAL_KEY missing' }, { status: 500 })
    }

    // ---------- Auth ----------
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ---------- Parse body ----------
    const { title, prompt, duration } = await req.json()

    if (!title || typeof title !== 'string' || title.trim().length < 1 || title.trim().length > 100)
      return NextResponse.json({ error: 'Title is required (1-100 characters)' }, { status: 400 })
    if (!prompt || prompt.length < 3 || prompt.length > 500)
      return NextResponse.json({ error: 'Prompt is required (3-500 characters)' }, { status: 400 })
    if (!duration || typeof duration !== 'number' || duration < 5 || duration > 180)
      return NextResponse.json({ error: 'Duration must be between 5 and 180 seconds' }, { status: 400 })

    // Calculate credit cost: 2 credits per 60 seconds, minimum 2
    const creditCost = Math.max(2, Math.ceil((duration / 60) * 2))

    console.log(`🥁 Beat Maker — "${title}" | ${prompt.substring(0, 60)} | ${duration}s | ${creditCost} credits`)

    // ---------- Credits ----------
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,free_credits`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const users = await userRes.json()
    if (!users?.length) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const totalCredits = (users[0].credits || 0) + (users[0].free_credits || 0)
    if (totalCredits < creditCost)
      return NextResponse.json({
        error: `Insufficient credits. Beat Maker requires ${creditCost} credits for ${duration}s.`,
        creditsNeeded: creditCost,
        creditsAvailable: totalCredits
      }, { status: 402 })

    const deductRes = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_clerk_user_id: userId, p_amount: creditCost }),
    })
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) { const raw = await deductRes.json(); deductResult = Array.isArray(raw) ? raw[0] ?? null : raw }
    if (!deductRes.ok || !deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      await logCreditTransaction({ userId, amount: -creditCost, type: 'generation_music', status: 'failed', description: `Beat Maker: ${title}`, metadata: { prompt, model: 'cassetteai-music-generator', duration } })
      return NextResponse.json({ error: errorMsg }, { status: 402 })
    }
    console.log(`✅ Credits deducted (${creditCost}). Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({
      userId,
      amount: -creditCost,
      balanceAfter: deductResult.new_credits,
      type: 'generation_music',
      description: `Beat Maker: ${title} (${duration}s)`,
      metadata: { prompt, model: 'cassetteai-music-generator', duration, creditCost }
    })

    // ---------- fal.ai generation ----------
    addLine({ type: 'started', model: 'cassetteai-music-generator' })

    try {
      const falInput: Record<string, unknown> = {
        prompt: prompt.trim(),
        duration,
      }

      console.log('🥁 fal.ai input:', JSON.stringify(falInput))

      const result = await runFalAi(falKey, falInput)
      console.log('🥁 fal.ai done')

      // Extract audio URL from response
      const audioFile = result.data?.audio_file
      let audioUrl: string
      if (typeof audioFile === 'string') audioUrl = audioFile
      else if (audioFile?.url) audioUrl = audioFile.url
      else throw new Error('No audio URL in fal.ai output')

      console.log('🥁 fal.ai audio:', audioUrl)

      // Upload to R2
      const fileName = `beatmaker-${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.wav`
      const r2Result = await downloadAndUploadToR2(audioUrl, userId, 'music', fileName)
      if (!r2Result.success) throw new Error(`R2 upload failed: ${r2Result.error}`)
      audioUrl = r2Result.url
      console.log('✅ R2:', audioUrl)

      // Save to music_library
      const libraryEntry = {
        clerk_user_id: userId,
        title: title.trim(),
        prompt,
        audio_url: audioUrl,
        audio_format: 'wav',
        generation_params: {
          model: 'cassetteai-music-generator',
          duration,
          credit_cost: creditCost,
          type: 'beatmaker',
        },
        genre: 'beatmaker',
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

      // Quest / transaction tracking (fire & forget)
      import('@/lib/quest-progress').then(({ trackQuestProgress, trackModelUsage, trackGenerationStreak }) => {
        trackQuestProgress(userId, 'generate_songs').catch(() => {})
        trackModelUsage(userId, 'cassetteai-music-generator').catch(() => {})
        trackGenerationStreak(userId).catch(() => {})
      }).catch(() => {})
      updateTransactionMedia({ userId, type: 'generation_music', mediaUrl: audioUrl, mediaType: 'audio', title, extraMeta: { model: 'cassetteai-music-generator', duration } }).catch(() => {})

      // Notification: generation complete
      createNotification({
        userId,
        type: 'generation_complete',
        data: {
          title: `Beat Maker: ${title.trim()}`,
          message: `Your beat "${title.trim()}" (${duration}s) has been generated successfully.`,
          audioUrl,
          creditCost,
          creditsRemaining: deductResult.new_credits,
          model: 'Beat Maker',
        }
      }).catch(() => {})

      addLine({
        type: 'result',
        success: true,
        audioUrl,
        title: title.trim(),
        libraryId: savedMusic?.id || null,
        creditsRemaining: deductResult.new_credits,
        creditsDeducted: creditCost,
        duration,
      })
    } catch (genErr: any) {
      console.error('❌ Beat Maker generation error:', genErr?.message || genErr, genErr?.stack?.substring(0, 300))
      await refundCredits({
        userId,
        amount: creditCost,
        type: 'generation_music',
        reason: `Beat Maker error: ${title}`,
        metadata: { prompt, model: 'cassetteai-music-generator', error: String(genErr).substring(0, 200) }
      })

      // Notification: generation failed
      createNotification({
        userId,
        type: 'generation_failed',
        data: {
          title: `Beat Maker: ${title.trim()}`,
          message: `Your beat "${title.trim()}" failed to generate. ${creditCost} credits have been refunded.`,
          model: 'Beat Maker',
        }
      }).catch(() => {})

      addLine({ type: 'result', success: false, error: sanitizeError(genErr), creditsRemaining: deductResult.new_credits })
    }

    // Return collected NDJSON lines
    return new Response(ndjsonLines.join('\n') + '\n', {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error: any) {
    console.error('Beat Maker OUTER error:', error?.message || error, error?.stack?.substring(0, 500))
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 })
  }
}
