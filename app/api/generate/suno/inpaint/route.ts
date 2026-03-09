import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { notifyGenerationComplete, notifyGenerationFailed, notifyCreditDeduct } from '@/lib/notifications'

export const maxDuration = 300

// $0.075/gen → 50% profit → 4 credits @ $0.035/credit
const CREDIT_COST = 4
const FAL_MODEL = 'sonauto/v2/inpaint'

async function run444Inpaint(
  falKey: string,
  input: Record<string, unknown>,
): Promise<{ data: any }> {
  console.log('[444-Inpaint] Calling fal.ai:', FAL_MODEL)
  const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error')
    throw new Error(`444 Inpaint failed (${res.status}): ${errText.substring(0, 200)}`)
  }
  return { data: await res.json() }
}

/**
 * POST /api/generate/suno/inpaint
 *
 * 444 Inpaint — replace a section of a track.
 * Costs 4 credits. Returns NDJSON stream.
 *
 * Body: { audio_url, start, end, tags, lyrics_prompt, title?, prompt_strength?, balance_strength? }
 */
export async function POST(req: NextRequest) {
  console.log('[444-INPAINT] POST /api/generate/suno/inpaint')
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const falKey = process.env.FAL_KEY || process.env.fal_key
    if (!falKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

    const body = await req.json()
    const { audio_url, start, end, tags, lyrics_prompt, title, prompt_strength, balance_strength, selection_crop } = body

    // ---------- Validation ----------
    if (!audio_url || typeof audio_url !== 'string') return NextResponse.json({ error: 'Audio URL is required' }, { status: 400 })
    if (typeof start !== 'number' || typeof end !== 'number') return NextResponse.json({ error: 'Start and end times (seconds) are required' }, { status: 400 })
    if (end <= start) return NextResponse.json({ error: 'End time must be greater than start time' }, { status: 400 })
    if (!tags || (Array.isArray(tags) && tags.length === 0) || (typeof tags === 'string' && !tags.trim())) {
      return NextResponse.json({ error: 'Style tags are required for 444 Inpaint' }, { status: 400 })
    }
    if (lyrics_prompt === undefined || lyrics_prompt === null) {
      return NextResponse.json({ error: 'Lyrics are required (use empty string for instrumental)' }, { status: 400 })
    }

    const cleanTitle = (title || 'Inpainted Track').trim().slice(0, 80)

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
      return NextResponse.json({ error: `Insufficient credits. 444 Inpaint requires ${CREDIT_COST} credits.`, creditsNeeded: CREDIT_COST, creditsAvailable: totalCredits }, { status: 402 })
    }

    const deductRes = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_clerk_user_id: userId, p_amount: CREDIT_COST }),
    })
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) { const raw = await deductRes.json(); deductResult = Array.isArray(raw) ? raw[0] ?? null : raw }
    if (!deductRes.ok || !deductResult?.success) {
      await logCreditTransaction({ userId, amount: -CREDIT_COST, type: 'generation_music', status: 'failed', description: `444 Inpaint: ${cleanTitle}`, metadata: { audio_url } })
      return NextResponse.json({ error: deductResult?.error_message || 'Failed to deduct credits' }, { status: 402 })
    }
    await logCreditTransaction({ userId, amount: -CREDIT_COST, balanceAfter: deductResult.new_credits, type: 'generation_music', description: `444 Inpaint: ${cleanTitle}`, metadata: { audio_url, start, end, engine: '444-inpaint' } })

    // ---------- Stream ----------
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    let clientDisconnected = false
    const sendLine = async (d: Record<string, unknown>) => { if (!clientDisconnected) try { await writer.write(encoder.encode(JSON.stringify(d) + '\n')) } catch { clientDisconnected = true } }

    ;(async () => {
      try {
        await sendLine({ type: 'started', model: '444-inpaint' })

        const parsedTags: string[] = Array.isArray(tags) ? tags : tags.split(',').map((t: string) => t.trim()).filter(Boolean)

        const input: Record<string, unknown> = {
          audio_url,
          tags: parsedTags,
          lyrics_prompt: lyrics_prompt || '',
          sections: [{ start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100 }],
          output_format: 'wav',
          num_songs: 1,
        }
        if (prompt_strength && typeof prompt_strength === 'number') input.prompt_strength = prompt_strength
        if (balance_strength && typeof balance_strength === 'number') input.balance_strength = balance_strength
        if (selection_crop !== undefined) input.selection_crop = selection_crop

        await sendLine({ type: 'progress', message: 'Replacing section...' })
        const result = await run444Inpaint(falKey, input)

        const audioFiles = Array.isArray(result.data.audio) ? result.data.audio : [result.data.audio]
        const audioFile = audioFiles[0]
        if (!audioFile?.url) throw new Error('No audio URL returned')

        const fileName = `inpaint-${cleanTitle.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.wav`
        const r2 = await downloadAndUploadToR2(audioFile.url, userId, 'music', fileName)
        if (!r2.success) throw new Error(`Storage upload failed: ${r2.error}`)

        await fetch(`${supabaseUrl}/rest/v1/music_library`, {
          method: 'POST',
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ clerk_user_id: userId, title: cleanTitle, prompt: parsedTags.join(', '), lyrics: lyrics_prompt || '', audio_url: r2.url, audio_format: 'wav', generation_params: { engine: '444-inpaint', type: '444-inpaint', start, end, tags: parsedTags, seed: result.data.seed }, status: 'ready' }),
        }).catch(() => {})

        let libraryId: string | null = null
        try {
          const cmRes = await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
            method: 'POST',
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
            body: JSON.stringify({ user_id: userId, type: 'audio', title: cleanTitle, audio_prompt: parsedTags.join(', '), lyrics: lyrics_prompt || '', audio_url: r2.url, is_public: false, genre: '444-inpaint', metadata: JSON.stringify({ source: '444-inpaint', start, end, seed: result.data.seed, tags: parsedTags.join(', ') }) }),
          })
          if (cmRes.ok) { const d = await cmRes.json(); libraryId = (Array.isArray(d) ? d[0] : d)?.id }
        } catch {}

        updateTransactionMedia({ userId, type: 'generation_music', mediaUrl: r2.url, mediaType: 'audio', title: cleanTitle, extraMeta: { engine: '444-inpaint' } }).catch(() => {})
        notifyGenerationComplete(userId, libraryId || '', 'music', cleanTitle).catch(() => {})
        notifyCreditDeduct(userId, CREDIT_COST, `444 Inpaint: ${cleanTitle}`).catch(() => {})

        await sendLine({ type: 'result', success: true, audioUrl: r2.url, title: cleanTitle, lyrics: lyrics_prompt || '', libraryId, creditsRemaining: deductResult!.new_credits, creditsDeducted: CREDIT_COST, seed: result.data.seed })
        await writer.close().catch(() => {})
      } catch (error) {
        console.error('Inpaint error:', error)
        await refundCredits({ userId, amount: CREDIT_COST, type: 'generation_music', reason: `Inpaint error: ${String(error).substring(0, 80)}`, metadata: { audio_url } })
        notifyGenerationFailed(userId, 'music', '444 Inpaint error — credits refunded').catch(() => {})
        try { await sendLine({ type: 'result', success: false, error: '444 Radio is locking in. Please try again.' }); await writer.close() } catch {}
      }
    })()

    return new Response(stream.readable, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache', 'Transfer-Encoding': 'chunked' } })
  } catch (error) {
    return NextResponse.json({ success: false, error: '444 Radio is locking in. Please try again.' }, { status: 500 })
  }
}
