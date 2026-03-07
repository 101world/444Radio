import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { fal } from '@fal-ai/client'

// Allow up to 5 minutes for fal.ai generation
export const maxDuration = 300

// fal.ai model endpoint (internal — not shown to users)
const FAL_MODEL = 'fal-ai/ace-step/audio-to-audio'
const QUEUE_URL = `https://queue.fal.run/${FAL_MODEL}`

/** Helper to sleep for a given number of milliseconds */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/*──────────────────────────────────────────────────────────────────────────────
 * STEP 1 — Upload audio to fal.ai's own storage (guarantees accessibility)
 *────────────────────────────────────────────────────────────────────────────*/
async function uploadToFalStorage(falKey: string, audioUrl: string): Promise<string> {
  console.log('🎤 [fal-storage] Downloading audio from:', audioUrl)

  const res = await fetch(audioUrl)
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)

  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') || 'audio/wav'
  console.log(`🎤 [fal-storage] Downloaded: ${(buffer.length / 1024 / 1024).toFixed(2)} MB, type: ${contentType}`)

  fal.config({ credentials: falKey })

  const ext = contentType.includes('mp3') || contentType.includes('mpeg') ? 'mp3'
    : contentType.includes('ogg') ? 'ogg'
    : contentType.includes('webm') ? 'webm'
    : 'wav'
  const blob = new Blob([buffer], { type: contentType })
  const file = new File([blob], `voice-melody-input-${Date.now()}.${ext}`, { type: contentType })

  const falUrl = await fal.storage.upload(file)
  console.log('🎤 [fal-storage] Uploaded to fal.ai:', falUrl)
  return falUrl
}

/*──────────────────────────────────────────────────────────────────────────────
 * STEP 2 — Submit to fal.ai queue and poll (direct HTTP, full logging)
 *────────────────────────────────────────────────────────────────────────────*/
async function callFalQueue(falKey: string, input: Record<string, unknown>): Promise<any> {
  console.log('🎤 [queue] Submitting to:', QUEUE_URL)
  console.log('🎤 [queue] Payload:', JSON.stringify(input))

  const submitRes = await fetch(QUEUE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const submitBody = await submitRes.text()
  console.log(`🎤 [queue] Submit → ${submitRes.status}: ${submitBody.substring(0, 600)}`)

  if (!submitRes.ok) {
    throw new Error(`Queue submit failed: status=${submitRes.status} body=${submitBody.substring(0, 600)}`)
  }

  const submitData = JSON.parse(submitBody)
  const { request_id, response_url, status_url } = submitData
  if (!request_id) throw new Error(`No request_id in response: ${submitBody.substring(0, 300)}`)

  console.log('🎤 [queue] request_id:', request_id)
  console.log('🎤 [queue] status_url:', status_url)
  console.log('🎤 [queue] response_url:', response_url)

  // Poll for up to 4 minutes
  const maxPoll = 240_000
  const start = Date.now()
  let lastStatus = ''

  while (Date.now() - start < maxPoll) {
    await sleep(4000)

    try {
      const sRes = await fetch(status_url, {
        headers: { 'Authorization': `Key ${falKey}` },
      })
      if (!sRes.ok) {
        console.warn(`🎤 [queue] Status poll → ${sRes.status}`)
        continue
      }

      const sData = await sRes.json()
      const status = sData.status

      if (status !== lastStatus) {
        console.log(`🎤 [queue] Status changed: ${lastStatus || '(initial)'} → ${status}`)
        lastStatus = status
      }

      if (sData.logs?.length) {
        for (const l of sData.logs.slice(-3)) {
          console.log('🎤 [queue] Log:', l.message)
        }
      }

      if (status === 'COMPLETED') {
        console.log('🎤 [queue] Fetching result from:', response_url)
        const rRes = await fetch(response_url, {
          headers: { 'Authorization': `Key ${falKey}` },
        })
        const rBody = await rRes.text()
        console.log(`🎤 [queue] Result → ${rRes.status}: ${rBody.substring(0, 600)}`)
        if (!rRes.ok) throw new Error(`Result fetch failed: ${rRes.status} ${rBody.substring(0, 600)}`)
        return JSON.parse(rBody)
      }

      if (status === 'FAILED') {
        // Extract as much error info as possible
        const errParts = [
          sData.error && `error=${JSON.stringify(sData.error).substring(0, 300)}`,
          sData.detail && `detail=${sData.detail}`,
          sData.logs?.length && `lastLog=${sData.logs[sData.logs.length - 1]?.message}`,
        ].filter(Boolean).join(' | ')
        throw new Error(`Generation FAILED in queue: ${errParts || JSON.stringify(sData).substring(0, 500)}`)
      }
    } catch (pollErr: any) {
      if (pollErr.message.includes('FAILED') || pollErr.message.includes('Result fetch')) throw pollErr
      console.warn('🎤 [queue] Poll error (will retry):', pollErr?.message)
    }
  }

  throw new Error('Generation timed out after 4 minutes')
}

/*──────────────────────────────────────────────────────────────────────────────
 * Orchestrator — attempts queue with fal-storage URL, then with original URL
 *────────────────────────────────────────────────────────────────────────────*/
async function runFalAi(falKey: string, input: Record<string, unknown>): Promise<{ data: any }> {
  console.log('🎤 ═══════ Voice Melody generation start ═══════')
  console.log('🎤 Original audio_url:', input.audio_url)

  const originalUrl = input.audio_url as string

  // --- Attempt 1: Upload to fal storage → queue API ---
  let falStorageUrl: string | null = null
  try {
    falStorageUrl = await uploadToFalStorage(falKey, originalUrl)
  } catch (uploadErr: any) {
    console.warn('⚠️ [fal-storage] Upload failed:', uploadErr?.message)
  }

  const attempt1Url = falStorageUrl || originalUrl
  try {
    console.log('🎤 [attempt-1] Using audio URL:', attempt1Url)
    const data = await callFalQueue(falKey, { ...input, audio_url: attempt1Url })
    console.log('🎤 ═══════ Voice Melody generation success (attempt 1) ═══════')
    return { data }
  } catch (err1: any) {
    console.error('❌ [attempt-1] Failed:', err1?.message)
  }

  // --- Attempt 2: Try original R2 URL with minimal params (5s cooldown) ---
  console.log('🔄 Waiting 5s before retry...')
  await sleep(5000)

  try {
    const minimalInput = {
      audio_url: originalUrl,
      original_tags: input.original_tags,
      tags: input.tags,
      edit_mode: input.edit_mode || 'remix',
    }
    console.log('🎤 [attempt-2] Using original URL with minimal params')
    const data = await callFalQueue(falKey, minimalInput)
    console.log('🎤 ═══════ Voice Melody generation success (attempt 2) ═══════')
    return { data }
  } catch (err2: any) {
    console.error('❌ [attempt-2] Also failed:', err2?.message)

    // --- Attempt 3: Try fal-storage URL if available, with minimal params ---
    if (falStorageUrl && falStorageUrl !== originalUrl) {
      console.log('🔄 [attempt-3] Trying fal-storage URL with minimal params...')
      await sleep(3000)
      try {
        const data = await callFalQueue(falKey, {
          audio_url: falStorageUrl,
          original_tags: input.original_tags,
          tags: input.tags,
          edit_mode: input.edit_mode || 'remix',
        })
        console.log('🎤 ═══════ Voice Melody generation success (attempt 3) ═══════')
        return { data }
      } catch (err3: any) {
        console.error('❌ [attempt-3] Also failed:', err3?.message)
      }
    }

    throw new Error(`Voice Melody generation failed after all attempts. Last error: ${err2?.message}`)
  }
}

function sanitizeError(error: any): string {
  const errorStr = error instanceof Error ? error.message : String(error)
  console.error('🔍 sanitizeError raw:', errorStr)
  if (errorStr.includes('audio') && (errorStr.includes('format') || errorStr.includes('decode') || errorStr.includes('codec'))) {
    return 'Audio format not supported. Please try uploading a WAV file instead.'
  }
  if (errorStr.includes('too short') || errorStr.includes('duration')) {
    return 'Audio is too short. Please record or upload at least 15 seconds.'
  }
  if (errorStr.includes('timed out')) {
    return 'Generation took too long. Please try a shorter audio clip.'
  }
  if (errorStr.includes('Queue submit failed') || errorStr.includes('FAILED in queue')) {
    return 'Voice Melody model is currently busy. Please try again in a few minutes.'
  }
  return '444 radio is locking in, please try again in a few minutes'
}

/**
 * POST /api/generate/voice-melody
 *
 * Uses fal.ai to transform voice melody / humming
 * into a full instrumental or re-styled track. Costs 2 credits.
 *
 * edit_mode: "remix" — transforms audio style/genre
 * edit_mode: "lyrics" — re-sings with new lyrics keeping melody
 *
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
    const {
      title,
      audio_url,
      original_tags,
      tags,
      edit_mode = 'remix',
      lyrics,
      original_lyrics,
      number_of_steps,
      seed,
      scheduler,
      guidance_type,
      granularity_scale,
      guidance_interval,
      guidance_interval_decay,
      guidance_scale,
      minimum_guidance_scale,
      tag_guidance_scale,
      lyric_guidance_scale,
    } = await req.json()

    if (!title || typeof title !== 'string' || title.trim().length < 1 || title.trim().length > 100)
      return NextResponse.json({ error: 'Title is required (1-100 characters)' }, { status: 400 })
    if (!audio_url)
      return NextResponse.json({ error: 'An input audio file URL is required' }, { status: 400 })
    if (!tags || typeof tags !== 'string' || tags.trim().length < 1)
      return NextResponse.json({ error: 'Genre tags are required' }, { status: 400 })
    if (!original_tags || typeof original_tags !== 'string' || original_tags.trim().length < 1)
      return NextResponse.json({ error: 'Original genre tags are required' }, { status: 400 })

    console.log('🎤 Voice Melody →', title, '|', tags, '| mode:', edit_mode)

    // ---------- Verify audio URL is accessible ----------
    try {
      const headRes = await fetch(audio_url, { method: 'HEAD' })
      if (!headRes.ok) {
        console.error('❌ Input audio URL not accessible:', audio_url, 'status:', headRes.status)
        return NextResponse.json({ error: 'Input audio file is not accessible. Please re-upload.' }, { status: 400 })
      }
      const contentType = headRes.headers.get('content-type') || ''
      console.log('🎤 Input audio verified — content-type:', contentType, 'size:', headRes.headers.get('content-length'))
    } catch (headErr) {
      console.error('❌ Could not reach input audio URL:', audio_url, headErr)
      return NextResponse.json({ error: 'Input audio file is not reachable. Please re-upload.' }, { status: 400 })
    }

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
    if (totalCredits < 2) return NextResponse.json({ error: 'Insufficient credits. Voice Melody requires 2 credits.', creditsNeeded: 2, creditsAvailable: totalCredits }, { status: 402 })

    const deductRes = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_clerk_user_id: userId, p_amount: 2 }),
    })
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) { const raw = await deductRes.json(); deductResult = Array.isArray(raw) ? raw[0] ?? null : raw }
    if (!deductRes.ok || !deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      await logCreditTransaction({ userId, amount: -2, type: 'generation_music', status: 'failed', description: `Voice Melody: ${title}`, metadata: { tags, model: 'voice-melody' } })
      return NextResponse.json({ error: errorMsg }, { status: 402 })
    }
    console.log(`✅ Credits deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId, amount: -2, balanceAfter: deductResult.new_credits, type: 'generation_music', description: `Voice Melody: ${title}`, metadata: { tags, model: 'voice-melody' } })

    // ---------- Voice Melody generation ----------
    addLine({ type: 'started', model: 'voice-melody' })

    try {
      const falInput: Record<string, unknown> = {
        audio_url,
        original_tags: original_tags.trim(),
        tags: tags.trim(),
        edit_mode: edit_mode === 'lyrics' ? 'lyrics' : 'remix',
      }
      // Optional fields
      if (lyrics && typeof lyrics === 'string' && lyrics.trim()) falInput.lyrics = lyrics.trim()
      if (original_lyrics && typeof original_lyrics === 'string') falInput.original_lyrics = original_lyrics.trim()
      if (typeof number_of_steps === 'number' && number_of_steps > 0) falInput.number_of_steps = number_of_steps
      if (typeof seed === 'number' && seed >= 0) falInput.seed = seed
      if (scheduler === 'euler' || scheduler === 'heun') falInput.scheduler = scheduler
      if (['cfg', 'apg', 'cfg_star'].includes(guidance_type)) falInput.guidance_type = guidance_type
      if (typeof granularity_scale === 'number') falInput.granularity_scale = granularity_scale
      if (typeof guidance_interval === 'number') falInput.guidance_interval = guidance_interval
      if (typeof guidance_interval_decay === 'number') falInput.guidance_interval_decay = guidance_interval_decay
      if (typeof guidance_scale === 'number') falInput.guidance_scale = guidance_scale
      if (typeof minimum_guidance_scale === 'number') falInput.minimum_guidance_scale = minimum_guidance_scale
      if (typeof tag_guidance_scale === 'number') falInput.tag_guidance_scale = tag_guidance_scale
      if (typeof lyric_guidance_scale === 'number') falInput.lyric_guidance_scale = lyric_guidance_scale

      console.log('🎤 Voice Melody input:', JSON.stringify(falInput))

      const result = await runFalAi(falKey, falInput)
      console.log('🎤 Voice Melody generation done')

      // Extract audio URL from response: { audio: { url: "..." }, seed, tags, lyrics }
      const audioData = result.data?.audio
      let audioUrl: string
      if (typeof audioData === 'string') audioUrl = audioData
      else if (audioData?.url) audioUrl = audioData.url
      else throw new Error('No audio URL in Voice Melody output')

      const resultSeed = result.data?.seed
      const resultTags = result.data?.tags
      const resultLyrics = result.data?.lyrics
      console.log('🎤 Voice Melody audio:', audioUrl, 'seed:', resultSeed, 'tags:', resultTags)

      // Upload to R2
      const fileName = `voice-melody-${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.wav`
      const r2Result = await downloadAndUploadToR2(audioUrl, userId, 'music', fileName)
      if (!r2Result.success) throw new Error(`R2 upload failed: ${r2Result.error}`)
      audioUrl = r2Result.url
      console.log('✅ R2:', audioUrl)

      // Save to combined_media with genre='voice-melody' for library tab
      const mediaEntry = {
        user_id: userId,
        title: title.trim(),
        prompt: `[${edit_mode}] ${tags}`,
        audio_url: audioUrl,
        genre: 'voice-melody',
        metadata: {
          model: 'voice-melody',
          edit_mode,
          original_tags: original_tags.trim(),
          tags: tags.trim(),
          lyrics: resultLyrics || lyrics || '',
          number_of_steps: falInput.number_of_steps || 27,
          seed: resultSeed || seed,
          input_audio_url: audio_url,
          audio_format: 'wav',
        },
      }
      const saveRes = await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
        method: 'POST',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(mediaEntry),
      })
      let savedMusic: any = null
      if (saveRes.ok) { const d = await saveRes.json(); savedMusic = Array.isArray(d) ? d[0] : d; console.log('✅ Library (combined_media voice-melody):', savedMusic?.title) }
      else console.error('❌ Library save failed:', saveRes.status, await saveRes.text().catch(() => ''))

      // Quest / transaction tracking (fire & forget)
      import('@/lib/quest-progress').then(({ trackQuestProgress, trackModelUsage, trackGenerationStreak }) => {
        trackQuestProgress(userId, 'generate_songs').catch(() => {})
        trackModelUsage(userId, 'voice-melody').catch(() => {})
        trackGenerationStreak(userId).catch(() => {})
      }).catch(() => {})
      updateTransactionMedia({ userId, type: 'generation_music', mediaUrl: audioUrl, mediaType: 'audio', title, extraMeta: { model: 'voice-melody' } }).catch(() => {})

      addLine({
        type: 'result',
        success: true,
        audioUrl,
        title: title.trim(),
        libraryId: savedMusic?.id || null,
        creditsRemaining: deductResult.new_credits,
        creditsDeducted: 2,
        seed: resultSeed,
        tags: resultTags,
        lyrics: resultLyrics,
      })
    } catch (genErr: any) {
      console.error('❌ Voice Melody error:', genErr?.message || genErr, genErr?.stack?.substring(0, 300))
      await refundCredits({ userId, amount: 2, type: 'generation_music', reason: `Voice Melody error: ${title}`, metadata: { tags, model: 'voice-melody', error: String(genErr).substring(0, 200) } })
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
    console.error('Voice Melody OUTER error:', error?.message || error, error?.stack?.substring(0, 500))
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 })
  }
}
