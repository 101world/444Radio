import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { notifyGenerationComplete, notifyGenerationFailed, notifyCreditDeduct } from '@/lib/notifications'
import {
  createMusicVideo,
  pollMusicVideoUntilDone,
  sanitizeSunoError,
  SUNO_CREDIT_COSTS,
} from '@/lib/suno-api'

export const maxDuration = 300

const CREDIT_COST = SUNO_CREDIT_COSTS.musicVideo // 22 credits

/**
 * POST /api/generate/suno/music-video
 *
 * 444 Pro Music Video — create a visualized MP4 from a previously generated track.
 * Costs 22 credits. Returns NDJSON stream.
 *
 * Body: { taskId, audioId, author?, domainName? }
 */
export async function POST(req: NextRequest) {
  console.log('🎬 [444-MUSICVIDEO] POST /api/generate/suno/music-video')
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { taskId, audioId, author = '444 Radio', domainName = '444radio.co.in' } = body

    if (!taskId || typeof taskId !== 'string') return NextResponse.json({ error: 'taskId is required — provide the task ID from a previous music generation' }, { status: 400 })
    if (!audioId || typeof audioId !== 'string') return NextResponse.json({ error: 'audioId is required — provide the audio ID of the track' }, { status: 400 })

    const cleanAuthor = (author || '444 Radio').trim().slice(0, 50)
    const cleanDomain = (domainName || '444radio.co.in').trim().slice(0, 50)

    // ---------- Credits ----------
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,free_credits`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    )
    const users = await userRes.json()
    if (!users?.length) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const totalCredits = (users[0].credits || 0) + (users[0].free_credits || 0)
    if (totalCredits < CREDIT_COST) {
      return NextResponse.json({ error: `Insufficient credits. 444 Music Video requires ${CREDIT_COST} credits.`, creditsNeeded: CREDIT_COST, creditsAvailable: totalCredits }, { status: 402 })
    }

    const deductRes = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_clerk_user_id: userId, p_amount: CREDIT_COST }),
    })
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) { const raw = await deductRes.json(); deductResult = Array.isArray(raw) ? raw[0] ?? null : raw }
    if (!deductRes.ok || !deductResult?.success) {
      await logCreditTransaction({ userId, amount: -CREDIT_COST, type: 'generation_music', status: 'failed', description: `444 Music Video`, metadata: { taskId, audioId } })
      return NextResponse.json({ error: deductResult?.error_message || 'Failed to deduct credits' }, { status: 402 })
    }
    await logCreditTransaction({ userId, amount: -CREDIT_COST, balanceAfter: deductResult.new_credits, type: 'generation_music', description: `444 Music Video`, metadata: { taskId, audioId, engine: '444-music-video' } })

    // ---------- Stream ----------
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    let clientDisconnected = false
    const sendLine = async (d: Record<string, unknown>) => { if (!clientDisconnected) try { await writer.write(encoder.encode(JSON.stringify(d) + '\n')) } catch { clientDisconnected = true } }

    ;(async () => {
      try {
        await sendLine({ type: 'started', model: '444-music-video' })

        const videoTask = await createMusicVideo({
          taskId,
          audioId,
          callBackUrl: 'https://www.444radio.co.in/api/webhook/generation-callback',
          author: cleanAuthor,
          domainName: cleanDomain,
        })
        const videoTaskId = videoTask.data.taskId
        await sendLine({ type: 'progress', message: 'Creating your music video...', taskId: videoTaskId })

        const completed = await pollMusicVideoUntilDone(videoTaskId)
        const videoUrl = completed.data.response?.videoUrl
        if (!videoUrl) throw new Error('No video URL in result')

        // Download to R2 for permanent storage
        const fileName = `mv-${taskId.substring(0, 15)}-${Date.now()}.mp4`
        const r2 = await downloadAndUploadToR2(videoUrl, userId, 'video', fileName)
        if (!r2.success) throw new Error(`Storage upload failed: ${r2.error}`)

        // Save to combined_media
        let libraryId: string | null = null
        try {
          const cmRes = await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
            method: 'POST',
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
            body: JSON.stringify({ user_id: userId, type: 'video', title: `Music Video`, audio_url: r2.url, is_public: false, genre: '444-music-video', metadata: JSON.stringify({ source: '444-music-video', original_task_id: taskId, audio_id: audioId, author: cleanAuthor }) }),
          })
          if (cmRes.ok) { const d = await cmRes.json(); libraryId = (Array.isArray(d) ? d[0] : d)?.id }
        } catch {}

        updateTransactionMedia({ userId, type: 'generation_music', mediaUrl: r2.url, mediaType: 'video', title: 'Music Video', extraMeta: { engine: '444-music-video' } }).catch(() => {})
        notifyGenerationComplete(userId, libraryId || '', 'video', 'Music Video').catch(() => {})
        notifyCreditDeduct(userId, CREDIT_COST, `444 Music Video`).catch(() => {})

        await sendLine({ type: 'result', success: true, videoUrl: r2.url, libraryId, creditsRemaining: deductResult!.new_credits, creditsDeducted: CREDIT_COST })
        await writer.close().catch(() => {})
      } catch (error) {
        console.error('❌ Music Video error:', error)
        await refundCredits({ userId, amount: CREDIT_COST, type: 'generation_music', reason: `Music Video error: ${String(error).substring(0, 80)}`, metadata: { taskId, audioId } })
        notifyGenerationFailed(userId, 'video', '444 Music Video error — credits refunded').catch(() => {})
        try { await sendLine({ type: 'result', success: false, error: sanitizeSunoError(error) }); await writer.close() } catch {}
      }
    })()

    return new Response(stream.readable, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache', 'Transfer-Encoding': 'chunked' } })
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeSunoError(error) }, { status: 500 })
  }
}
