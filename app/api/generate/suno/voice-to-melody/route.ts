import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { notifyGenerationComplete, notifyGenerationFailed, notifyCreditDeduct } from '@/lib/notifications'
import {
  addInstrumental,
  pollTaskUntilDone,
  sanitizeSunoError,
  SUNO_CREDIT_COSTS,
} from '@/lib/suno-api'

export const maxDuration = 300

const CREDIT_COST = SUNO_CREDIT_COSTS.addInstrumental

/**
 * POST /api/generate/suno/voice-to-melody
 *
 * 444 Pro Voice-to-Melody — add instrumental backing to a vocal/melody/hum recording.
 * Costs 22 credits. Returns NDJSON stream.
 * Models: V4_5PLUS or V5 only.
 *
 * Body: { uploadUrl, title, tags, negativeTags?, model?, vocalGender? }
 */
export async function POST(req: NextRequest) {
  console.log('🎵 [444-VOICE2MELODY] POST /api/generate/suno/voice-to-melody')
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { uploadUrl, title, tags, negativeTags: rawNegTags, model = 'V4_5PLUS', vocalGender } = body
    const negativeTags = (rawNegTags && String(rawNegTags).trim()) || 'noise, distortion'

    if (!uploadUrl || typeof uploadUrl !== 'string') return NextResponse.json({ error: 'uploadUrl is required — provide a public URL to your vocal/melody recording' }, { status: 400 })
    if (!tags || typeof tags !== 'string') return NextResponse.json({ error: 'Style tags are required' }, { status: 400 })

    const cleanTitle = (title || 'Voice to Melody').trim().slice(0, 80)
    const cleanTags = tags.trim().slice(0, 1000)
    const validModel = model === 'V5' ? 'V5' : 'V4_5PLUS'

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
      return NextResponse.json({ error: `Insufficient credits. 444 Voice-to-Melody requires ${CREDIT_COST} credits.`, creditsNeeded: CREDIT_COST, creditsAvailable: totalCredits }, { status: 402 })
    }

    const deductRes = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_clerk_user_id: userId, p_amount: CREDIT_COST }),
    })
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) { const raw = await deductRes.json(); deductResult = Array.isArray(raw) ? raw[0] ?? null : raw }
    if (!deductRes.ok || !deductResult?.success) {
      await logCreditTransaction({ userId, amount: -CREDIT_COST, type: 'generation_music', status: 'failed', description: `444 Voice-to-Melody: ${cleanTitle}`, metadata: { uploadUrl } })
      return NextResponse.json({ error: deductResult?.error_message || 'Failed to deduct credits' }, { status: 402 })
    }
    await logCreditTransaction({ userId, amount: -CREDIT_COST, balanceAfter: deductResult.new_credits, type: 'generation_music', description: `444 Voice-to-Melody: ${cleanTitle}`, metadata: { uploadUrl, model: validModel, engine: '444-voice-to-melody' } })

    // ---------- Stream ----------
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    let clientDisconnected = false
    const sendLine = async (d: Record<string, unknown>) => { if (!clientDisconnected) try { await writer.write(encoder.encode(JSON.stringify(d) + '\n')) } catch { clientDisconnected = true } }

    ;(async () => {
      try {
        await sendLine({ type: 'started', model: '444-voice-to-melody' })

        const taskRes = await addInstrumental({
          uploadUrl,
          title: cleanTitle,
          tags: cleanTags,
          negativeTags,
          callBackUrl: 'https://www.444radio.co.in/api/webhook/generation-callback',
          vocalGender,
          model: validModel,
        })
        const taskId = taskRes.data.taskId
        await sendLine({ type: 'progress', message: 'Creating instrumental from your melody...', taskId })

        const completed = await pollTaskUntilDone(taskId)
        // V5 may return tracks at different response paths
        const cData = completed.data as Record<string, any>
        const tracks = cData.response?.data || cData?.data || []
        if (!tracks.length) throw new Error('No tracks returned')

        const track = tracks[0]
        const trackAudioUrl = track.audio_url || track.audioUrl || track.stream_audio_url || track.streamAudioUrl || track.song_url || track.songUrl || track.url || track.mp3_url || track.output
        if (!trackAudioUrl) throw new Error('No audio URL in result')
        const trackLyric = track.lyric || track.lyrics || ''

        const fileName = `v2m-${cleanTitle.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.wav`
        const r2 = await downloadAndUploadToR2(trackAudioUrl, userId, 'music', fileName)
        if (!r2.success) throw new Error(`Storage upload failed: ${r2.error}`)

        await fetch(`${supabaseUrl}/rest/v1/music_library`, {
          method: 'POST',
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ clerk_user_id: userId, title: cleanTitle, prompt: cleanTags, lyrics: trackLyric, audio_url: r2.url, audio_format: 'wav', generation_params: { engine: '444-voice-to-melody', type: '444-voice-to-melody', model: validModel, source_url: uploadUrl }, status: 'ready' }),
        }).catch(() => {})

        let libraryId: string | null = null
        try {
          const cmRes = await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
            method: 'POST',
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
            body: JSON.stringify({ user_id: userId, type: 'audio', title: cleanTitle, audio_prompt: cleanTags, lyrics: trackLyric, audio_url: r2.url, is_public: false, genre: '444-voice-to-melody', metadata: JSON.stringify({ source: '444-voice-to-melody', model: validModel, duration: track.duration, tags: cleanTags || null }) }),
          })
          if (cmRes.ok) { const d = await cmRes.json(); libraryId = (Array.isArray(d) ? d[0] : d)?.id }
        } catch {}

        updateTransactionMedia({ userId, type: 'generation_music', mediaUrl: r2.url, mediaType: 'audio', title: cleanTitle, extraMeta: { engine: '444-voice-to-melody' } }).catch(() => {})
        notifyGenerationComplete(userId, libraryId || '', 'music', cleanTitle).catch(() => {})
        notifyCreditDeduct(userId, CREDIT_COST, `444 Voice-to-Melody: ${cleanTitle}`).catch(() => {})

        await sendLine({ type: 'result', success: true, audioUrl: r2.url, title: cleanTitle, lyrics: trackLyric, libraryId, creditsRemaining: deductResult!.new_credits, creditsDeducted: CREDIT_COST })
        await writer.close().catch(() => {})
      } catch (error) {
        console.error('❌ Voice-to-Melody error:', error)
        await refundCredits({ userId, amount: CREDIT_COST, type: 'generation_music', reason: `Voice-to-Melody error: ${String(error).substring(0, 80)}`, metadata: { uploadUrl } })
        notifyGenerationFailed(userId, 'music', '444 Voice-to-Melody error — credits refunded').catch(() => {})
        try { await sendLine({ type: 'result', success: false, error: sanitizeSunoError(error) }); await writer.close() } catch {}
      }
    })()

    return new Response(stream.readable, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache', 'Transfer-Encoding': 'chunked' } })
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeSunoError(error) }, { status: 500 })
  }
}
