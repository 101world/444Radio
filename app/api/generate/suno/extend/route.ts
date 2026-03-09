import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { notifyGenerationComplete, notifyGenerationFailed, notifyCreditDeduct } from '@/lib/notifications'
import {
  extendMusic,
  pollTaskUntilDone,
  sanitizeSunoError,
  SUNO_CREDIT_COSTS,
  type SunoModel,
} from '@/lib/suno-api'

export const maxDuration = 300

const CREDIT_COST = SUNO_CREDIT_COSTS.extend

/**
 * POST /api/generate/suno/extend
 *
 * 444 Pro Extend — extend/outpaint an existing track.
 * Costs 22 credits. Returns NDJSON stream.
 *
 * Body: { audioId, title, prompt, style, continueAt, model?, vocalGender? }
 */
export async function POST(req: NextRequest) {
  console.log('🎵 [444-EXTEND] POST /api/generate/suno/extend')
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { audioId, title, prompt, style, continueAt, model = 'V4_5ALL', vocalGender, negativeTags, personaId } = body

    if (!audioId || typeof audioId !== 'string') {
      return NextResponse.json({ error: 'Audio ID is required' }, { status: 400 })
    }
    if (continueAt === undefined || typeof continueAt !== 'number' || continueAt <= 0) {
      return NextResponse.json({ error: 'continueAt (seconds) is required and must be > 0' }, { status: 400 })
    }

    const cleanTitle = (title || 'Extended Track').trim().slice(0, 80)
    const cleanPrompt = prompt?.trim().slice(0, 5000) || ''
    const cleanStyle = style?.trim().slice(0, 1000) || undefined
    const useCustom = !!(cleanPrompt || cleanStyle)

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
      return NextResponse.json({ error: `Insufficient credits. 444 Extend requires ${CREDIT_COST} credits.`, creditsNeeded: CREDIT_COST, creditsAvailable: totalCredits }, { status: 402 })
    }

    const deductRes = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_clerk_user_id: userId, p_amount: CREDIT_COST }),
    })
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) { const raw = await deductRes.json(); deductResult = Array.isArray(raw) ? raw[0] ?? null : raw }
    if (!deductRes.ok || !deductResult?.success) {
      await logCreditTransaction({ userId, amount: -CREDIT_COST, type: 'generation_music', status: 'failed', description: `444 Extend: ${cleanTitle}`, metadata: { audioId } })
      return NextResponse.json({ error: deductResult?.error_message || 'Failed to deduct credits' }, { status: 402 })
    }
    await logCreditTransaction({ userId, amount: -CREDIT_COST, balanceAfter: deductResult.new_credits, type: 'generation_music', description: `444 Extend: ${cleanTitle}`, metadata: { audioId, continueAt, model, engine: '444-extend' } })

    // ---------- Stream ----------
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    let clientDisconnected = false
    const sendLine = async (d: Record<string, unknown>) => { if (!clientDisconnected) try { await writer.write(encoder.encode(JSON.stringify(d) + '\n')) } catch { clientDisconnected = true } }

    ;(async () => {
      try {
        await sendLine({ type: 'started', model: '444-extend' })

        const taskRes = await extendMusic({
          audioId,
          defaultParamFlag: useCustom,
          model: model as SunoModel,
          callBackUrl: '',
          prompt: cleanPrompt || undefined,
          style: cleanStyle,
          title: cleanTitle,
          continueAt,
          vocalGender,
          negativeTags,
          personaId,
        })
        const taskId = taskRes.data.taskId
        await sendLine({ type: 'progress', message: 'Extending your track...', taskId })

        const completed = await pollTaskUntilDone(taskId)
        const tracks = completed.data.response?.data || []
        if (!tracks.length) throw new Error('No tracks returned')

        const track = tracks[0]
        if (!track.audio_url) throw new Error('No audio URL in result')

        const fileName = `extend-${cleanTitle.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.mp3`
        const r2 = await downloadAndUploadToR2(track.audio_url, userId, 'music', fileName)
        if (!r2.success) throw new Error(`Storage upload failed: ${r2.error}`)

        // Save to music_library
        await fetch(`${supabaseUrl}/rest/v1/music_library`, {
          method: 'POST',
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ clerk_user_id: userId, title: cleanTitle, prompt: cleanPrompt, lyrics: track.lyric || '', audio_url: r2.url, audio_format: 'mp3', generation_params: { model, engine: '444-extend', source_audio: audioId }, status: 'ready' }),
        }).catch(() => {})

        // Save to combined_media
        let libraryId: string | null = null
        try {
          const cmRes = await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
            method: 'POST',
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
            body: JSON.stringify({ user_id: userId, type: 'audio', title: cleanTitle, audio_prompt: cleanPrompt, lyrics: track.lyric || '', audio_url: r2.url, is_public: false, genre: cleanStyle || null, metadata: JSON.stringify({ source: '444-extend', model, duration: track.duration }) }),
          })
          if (cmRes.ok) { const d = await cmRes.json(); libraryId = (Array.isArray(d) ? d[0] : d)?.id }
        } catch {}

        updateTransactionMedia({ userId, type: 'generation_music', mediaUrl: r2.url, mediaType: 'audio', title: cleanTitle, extraMeta: { engine: '444-extend' } }).catch(() => {})
        notifyGenerationComplete(userId, libraryId || '', 'music', cleanTitle).catch(() => {})
        notifyCreditDeduct(userId, CREDIT_COST, `444 Extend: ${cleanTitle}`).catch(() => {})

        await sendLine({ type: 'result', success: true, audioUrl: r2.url, title: cleanTitle, lyrics: track.lyric || '', libraryId, creditsRemaining: deductResult!.new_credits, creditsDeducted: CREDIT_COST })
        await writer.close().catch(() => {})
      } catch (error) {
        console.error('❌ Extend error:', error)
        await refundCredits({ userId, amount: CREDIT_COST, type: 'generation_music', reason: `Extend error: ${String(error).substring(0, 80)}`, metadata: { audioId } })
        notifyGenerationFailed(userId, 'music', '444 Extend error — credits refunded').catch(() => {})
        try { await sendLine({ type: 'result', success: false, error: sanitizeSunoError(error) }); await writer.close() } catch {}
      }
    })()

    return new Response(stream.readable, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache', 'Transfer-Encoding': 'chunked' } })
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeSunoError(error) }, { status: 500 })
  }
}
