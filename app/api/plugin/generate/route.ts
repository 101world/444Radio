/**
 * Plugin Generate API — Unified generation endpoint for the VST3 plugin.
 * 
 * POST /api/plugin/generate
 * Auth: Bearer <plugin_token>
 * 
 * Accepts all generation types: music, effects, loops, image, stems, audio-boost
 * Creates an async job in plugin_jobs table, kicks off generation,
 * and returns a jobId for the plugin to poll via GET /api/plugin/jobs/[jobId].
 * 
 * The generation runs to completion in a single request (Vercel Pro 300s limit).
 * Results are saved to plugin_jobs.output AND to the user's library
 * (combined_media / music_library) — exactly like the website.
 */

import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'
import { authenticatePlugin, getPluginUserCredits, deductPluginCredits, createPluginJob, updatePluginJob } from '@/lib/plugin-auth'
import { corsResponse, handleOptions } from '@/lib/cors'
import { uploadToR2 } from '@/lib/r2-upload'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { findBestMatchingLyrics } from '@/lib/lyrics-matcher'
import { randomUUID } from 'crypto'

export const maxDuration = 300 // Vercel Pro 5-min limit

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function OPTIONS() {
  return handleOptions()
}

// ------------------------------------------------------------------
// Credit costs per generation type
// ------------------------------------------------------------------
const CREDIT_COSTS: Record<string, number | ((params: Record<string, unknown>) => number)> = {
  music: 2,
  image: 1,
  effects: 2,
  loops: (p) => ((p.max_duration as number) || 8) <= 10 ? 6 : 7,
  stems: 5,
  extract: 1,
  'audio-boost': 1,
  'video-to-audio': (p) => ((p.quality as string) === 'hq' ? 10 : 2),
}

function getCreditCost(type: string, params: Record<string, unknown>): number {
  const cost = CREDIT_COSTS[type]
  if (!cost) return 0
  return typeof cost === 'function' ? cost(params) : cost
}

// ------------------------------------------------------------------
// POST /api/plugin/generate
// ------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // ── Auth ──
  const authResult = await authenticatePlugin(req)
  if (!authResult.valid) {
    return corsResponse(NextResponse.json({ error: authResult.error }, { status: authResult.status }))
  }
  const userId = authResult.userId

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return corsResponse(NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }))
  }

  const type = body.type as string
  if (!type || !CREDIT_COSTS[type]) {
    return corsResponse(NextResponse.json({
      error: `Invalid type. Must be one of: ${Object.keys(CREDIT_COSTS).join(', ')}`,
    }, { status: 400 }))
  }

  // ── Credit check ──
  const creditCost = getCreditCost(type, body)
  const { credits } = await getPluginUserCredits(userId)
  if (credits < creditCost) {
    return corsResponse(NextResponse.json({
      error: `Insufficient credits. ${type} requires ${creditCost} credits, you have ${credits}.`,
      creditsNeeded: creditCost,
      creditsAvailable: credits,
    }, { status: 402 }))
  }

  // ── Create job ──
  const jobId = randomUUID()
  await createPluginJob({ jobId, userId, type, creditsCost: creditCost, inputParams: body })

  // ── Kick off generation (runs to completion in this request) ──
  // We use a streaming response so the plugin gets the jobId immediately,
  // then final result when done.
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  const sendLine = async (data: Record<string, unknown>) => {
    try { await writer.write(encoder.encode(JSON.stringify(data) + '\n')) } catch { /* stream closed */ }
  }

  const requestSignal = req.signal

  ;(async () => {
    try {
      // Send jobId immediately
      await sendLine({ type: 'started', jobId })

      let result: Record<string, unknown>

      switch (type) {
        case 'music':
          result = await generateMusic(userId, body, jobId, requestSignal)
          break
        case 'image':
          result = await generateImage(userId, body, jobId)
          break
        case 'effects':
          result = await generateEffects(userId, body, jobId)
          break
        case 'loops':
          result = await generateLoops(userId, body, jobId)
          break
        case 'stems':
          result = await generateStems(userId, body, jobId, requestSignal)
          break
        case 'audio-boost':
          result = await generateAudioBoost(userId, body, jobId)
          break
        case 'extract':
          result = await generateExtract(userId, body, jobId, requestSignal)
          break
        case 'video-to-audio':
          result = await generateVideoToAudio(userId, body, jobId, requestSignal)
          break
        default:
          result = { success: false, error: 'Unknown type' }
      }

      // ── Deduct credits on success ──
      if (result.success) {
        const deduct = await deductPluginCredits(userId, creditCost)
        result.creditsDeducted = creditCost
        result.creditsRemaining = deduct.success ? deduct.newCredits : credits - creditCost

        await logCreditTransaction({
          userId,
          amount: -creditCost,
          balanceAfter: deduct.newCredits,
          type: `generation_${type.replace('-', '_')}` as any,
          description: `Plugin: ${type} — ${(body.prompt as string || body.title as string || '').substring(0, 60)}`,
          metadata: { source: 'plugin', jobId },
        })

        await updatePluginJob(jobId, { status: 'completed', output: result as Record<string, unknown> })
      } else {
        await logCreditTransaction({
          userId,
          amount: 0,
          type: `generation_${type.replace('-', '_')}` as any,
          status: 'failed',
          description: `Plugin failed: ${type}`,
          metadata: { source: 'plugin', jobId, error: result.error },
        })
        await updatePluginJob(jobId, { status: 'failed', error: String(result.error) })
      }

      await sendLine({ type: 'result', jobId, ...result })
      await writer.close()
    } catch (error) {
      console.error(`[plugin/generate] Fatal error (${type}):`, error)
      await updatePluginJob(jobId, { status: 'failed', error: String(error) })
      try {
        await sendLine({ type: 'result', jobId, success: false, error: '444 radio is locking in, please try again' })
        await writer.close()
      } catch { /* stream closed */ }
    }
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

// ==================================================================
// GENERATION HANDLERS  (identical logic to existing endpoints,
//                        but save to plugin_jobs + user library)
// ==================================================================

// ──────────────────────────────────────────────────────────────────
// MUSIC  (mirrors /api/generate/music-only)
// ──────────────────────────────────────────────────────────────────
async function generateMusic(userId: string, body: Record<string, unknown>, jobId: string, signal: AbortSignal) {
  const title = (body.title as string || '').trim()
  const prompt = (body.prompt as string || '').trim()
  const lyrics = body.lyrics as string | undefined
  const duration = (body.duration as string) || 'medium'
  const genre = body.genre as string | undefined
  const bitrate = (body.bitrate as number) || 256000
  const sample_rate = (body.sample_rate as number) || 44100
  const audio_format = (body.audio_format as string) || 'mp3'
  const generateCoverArt = body.generateCoverArt === true

  if (!title || title.length < 3 || title.length > 100) {
    return { success: false, error: 'Title required (3-100 chars)' }
  }
  if (!prompt || prompt.length < 10 || prompt.length > 300) {
    return { success: false, error: 'Prompt required (10-300 chars)' }
  }

  // Lyrics — use smart matcher if not provided
  let formattedLyrics: string
  if (!lyrics || lyrics.trim().length === 0) {
    const matched = findBestMatchingLyrics(prompt)
    formattedLyrics = expandLyricsForDuration(matched.lyrics, duration as any)
  } else {
    formattedLyrics = expandLyricsForDuration(lyrics.trim(), duration as any)
  }
  if (formattedLyrics.length > 600) formattedLyrics = formattedLyrics.substring(0, 597) + '...'

  // Create prediction
  const prediction = await replicate.predictions.create({
    model: 'minimax/music-1.5',
    input: { prompt, lyrics: formattedLyrics, bitrate, sample_rate, audio_format },
  })

  await updatePluginJob(jobId, { status: 'processing', replicatePredictionId: prediction.id })

  // Poll
  let final = prediction
  let attempts = 0
  while (final.status !== 'succeeded' && final.status !== 'failed' && final.status !== 'canceled' && attempts < 150) {
    if (signal.aborted) {
      try { await replicate.predictions.cancel(prediction.id) } catch {}
      return { success: false, error: 'Generation cancelled' }
    }
    await new Promise(r => setTimeout(r, 2000))
    final = await replicate.predictions.get(prediction.id)
    attempts++
  }

  if (final.status !== 'succeeded') {
    return { success: false, error: final.error || `Generation ${final.status}` }
  }

  // Extract audio URL
  let audioUrl = extractUrl(final.output)
  if (!audioUrl) return { success: false, error: 'No audio in output' }

  // Upload to R2
  const fileName = `${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.${audio_format}`
  const r2 = await downloadAndUploadToR2(audioUrl, userId, 'music', fileName)
  if (!r2.success) return { success: false, error: 'Failed to save audio' }
  audioUrl = r2.url

  // Save to music_library
  await fetch(`${supabaseUrl}/rest/v1/music_library`, {
    method: 'POST',
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clerk_user_id: userId,
      title, prompt, lyrics: formattedLyrics,
      audio_url: audioUrl, audio_format, bitrate, sample_rate,
      generation_params: { bitrate, sample_rate, audio_format, source: 'plugin' },
      status: 'ready',
    }),
  })

  const result: Record<string, unknown> = {
    success: true,
    audioUrl,
    title,
    lyrics: formattedLyrics,
    format: audio_format,
  }

  // Cover art (if requested and can afford)
  if (generateCoverArt) {
    try {
      const imageUrl = await generateCoverArtForTrack(userId, prompt, title, genre)
      if (imageUrl) result.imageUrl = imageUrl
    } catch (e) {
      console.error('[plugin] Cover art failed:', e)
    }
  }

  return result
}

// ──────────────────────────────────────────────────────────────────
// IMAGE  (mirrors /api/generate/image-only)
// ──────────────────────────────────────────────────────────────────
async function generateImage(userId: string, body: Record<string, unknown>, jobId: string) {
  const prompt = (body.prompt as string || '').trim()
  if (!prompt) return { success: false, error: 'Missing prompt' }

  const params = (body.params as Record<string, unknown>) || {}

  await updatePluginJob(jobId, { status: 'processing' })

  let output: unknown
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      output = await replicate.run('black-forest-labs/flux-2-klein-9b-base', {
        input: {
          prompt,
          aspect_ratio: params.aspect_ratio ?? '1:1',
          output_format: params.output_format ?? 'jpg',
          output_quality: params.output_quality ?? 95,
          output_megapixels: params.output_megapixels ?? '1',
          guidance: params.guidance ?? 4,
          go_fast: true,
          images: [],
        },
      })
      break
    } catch (e: any) {
      if (attempt === 3) return { success: false, error: 'Image generation failed after retries' }
      await new Promise(r => setTimeout(r, attempt * 3000))
    }
  }

  let imageUrl = extractUrl(output)
  if (!imageUrl) return { success: false, error: 'No image generated' }

  const fmt = (params.output_format as string) || 'jpg'
  const fileName = `${prompt.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.${fmt}`
  const r2 = await downloadAndUploadToR2(imageUrl, userId, 'images', fileName)
  if (r2.success) imageUrl = r2.url

  // Save to images_library
  await fetch(`${supabaseUrl}/rest/v1/images_library`, {
    method: 'POST',
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clerk_user_id: userId,
      title: prompt.substring(0, 100),
      prompt, image_url: imageUrl,
      aspect_ratio: params.aspect_ratio ?? '1:1',
      image_format: fmt,
      generation_params: { ...params, source: 'plugin' },
      status: 'ready',
    }),
  })

  return { success: true, imageUrl, prompt }
}

// ──────────────────────────────────────────────────────────────────
// EFFECTS  (mirrors /api/generate/effects)
// ──────────────────────────────────────────────────────────────────
async function generateEffects(userId: string, body: Record<string, unknown>, jobId: string) {
  const prompt = (body.prompt as string || '').trim()
  if (!prompt) return { success: false, error: 'Missing prompt' }

  const duration = Math.min(10, Math.max(1, (body.duration as number) || 5))
  const output_format = (body.output_format as string) || 'mp3'

  await updatePluginJob(jobId, { status: 'processing' })

  const prediction = await replicate.predictions.create({
    model: 'sepal/audiogen',
    version: '154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8',
    input: {
      prompt, duration,
      top_k: (body.top_k as number) || 250,
      top_p: (body.top_p as number) || 0,
      temperature: (body.temperature as number) || 1,
      classifier_free_guidance: (body.classifier_free_guidance as number) || 3,
      output_format,
    },
  })

  await updatePluginJob(jobId, { replicatePredictionId: prediction.id })

  let final = prediction
  let attempts = 0
  while (final.status !== 'succeeded' && final.status !== 'failed' && attempts < 90) {
    await new Promise(r => setTimeout(r, 1000))
    final = await replicate.predictions.get(prediction.id)
    attempts++
  }

  if (final.status !== 'succeeded') {
    return { success: false, error: final.error || 'Effects generation failed' }
  }

  let audioUrl = extractUrl(final.output)
  if (!audioUrl) return { success: false, error: 'No output from AudioGen' }

  // Upload to R2
  const dlRes = await fetch(audioUrl)
  if (!dlRes.ok) return { success: false, error: 'Failed to download effects audio' }
  const buffer = Buffer.from(await dlRes.arrayBuffer())
  const r2Key = `${userId}/effects-${Date.now()}.${output_format}`
  const r2 = await uploadToR2(buffer, 'audio-files', r2Key)
  if (!r2.success) return { success: false, error: 'Failed to save effects' }
  audioUrl = r2.url!

  // Save to combined_media
  await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
    method: 'POST',
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId, type: 'audio',
      title: `SFX: ${prompt.substring(0, 50)}`,
      audio_prompt: prompt, prompt,
      audio_url: audioUrl, is_public: false, genre: 'effects',
    }),
  })

  return { success: true, audioUrl, prompt, duration }
}

// ──────────────────────────────────────────────────────────────────
// LOOPS  (mirrors /api/generate/loopers)
// ──────────────────────────────────────────────────────────────────
async function generateLoops(userId: string, body: Record<string, unknown>, jobId: string) {
  const prompt = (body.prompt as string || '').trim()
  if (!prompt) return { success: false, error: 'Missing prompt' }

  const bpm = (body.bpm as number) || 120
  const max_duration = Math.min(20, Math.max(1, (body.max_duration as number) || 8))
  const variations = Math.min(2, Math.max(1, (body.variations as number) || 2))
  const output_format = (body.output_format as string) || 'wav'

  await updatePluginJob(jobId, { status: 'processing' })

  const prediction = await replicate.predictions.create({
    model: 'andreasjansson/musicgen-looper',
    version: 'f8140d0457c2b39ad8728a80736fea9a67a0ec0cd37b35f40b68cce507db2366',
    input: {
      prompt, bpm, max_duration, variations,
      model_version: (body.model_version as string) || 'large',
      output_format,
      classifier_free_guidance: (body.classifier_free_guidance as number) || 3,
      temperature: (body.temperature as number) || 1,
      top_k: (body.top_k as number) || 250,
      top_p: (body.top_p as number) || 0,
      seed: (body.seed as number) || -1,
    },
  })

  await updatePluginJob(jobId, { replicatePredictionId: prediction.id })

  let final = prediction
  let attempts = 0
  while (final.status !== 'succeeded' && final.status !== 'failed' && attempts < 150) {
    await new Promise(r => setTimeout(r, 1000))
    final = await replicate.predictions.get(prediction.id)
    attempts++
  }

  if (final.status !== 'succeeded') {
    return { success: false, error: final.error || 'Loop generation failed' }
  }

  const output = final.output as Record<string, string | null>
  const loops: Array<{ url: string; variation: number }> = []

  for (let i = 1; i <= variations; i++) {
    const key = `variation_${i.toString().padStart(2, '0')}`
    const url = output[key]
    if (!url) continue

    const dlRes = await fetch(url)
    if (!dlRes.ok) continue
    const buffer = Buffer.from(await dlRes.arrayBuffer())
    const r2Key = `${userId}/loop-${Date.now()}-v${i}.${output_format}`
    const r2 = await uploadToR2(buffer, 'audio-files', r2Key)
    if (!r2.success || !r2.url) continue

    loops.push({ url: r2.url, variation: i })

    // Save each to combined_media
    await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId, type: 'audio',
        title: `Loop: ${prompt.substring(0, 40)} (v${i})`,
        audio_prompt: prompt, prompt,
        audio_url: r2.url, is_public: false, genre: 'loop',
        metadata: JSON.stringify({ bpm, duration: max_duration, variation: i, output_format }),
      }),
    })
  }

  if (loops.length === 0) return { success: false, error: 'No loops generated' }

  return { success: true, loops, prompt, bpm, duration: max_duration }
}

// ──────────────────────────────────────────────────────────────────
// STEMS  (all-in-one split — mirrors /api/audio/split-stems)
// Uses harmonix-all model to return ALL stems at once:
// vocals, drums, bass, piano, guitar, other
// ──────────────────────────────────────────────────────────────────
async function generateStems(userId: string, body: Record<string, unknown>, jobId: string, signal: AbortSignal) {
  const audioUrl = body.audioUrl as string
  if (!audioUrl) return { success: false, error: 'audioUrl required' }

  const trackTitle = (body.trackTitle as string) || 'Stem Split'

  await updatePluginJob(jobId, { status: 'processing' })

  // Use the same all-in-one harmonix model as /api/audio/split-stems
  const prediction = await replicate.predictions.create({
    version: 'f2a8516c9084ef460592deaa397acd4a97f60f18c3d15d273644c72500cdff0e',
    input: {
      music_input: audioUrl,
      model: 'harmonix-all',
      sonify: false,
      visualize: false,
      audioSeparator: true,
      include_embeddings: false,
      audioSeparatorModel: 'Kim_Vocal_2.onnx',
      include_activations: false,
    },
  })

  await updatePluginJob(jobId, { replicatePredictionId: prediction.id })

  let final = prediction
  let attempts = 0
  const MAX_POLL = 36 // 36 × 5s = 180s max
  while (final.status !== 'succeeded' && final.status !== 'failed' && final.status !== 'canceled' && attempts < MAX_POLL) {
    if (signal.aborted) {
      try { await replicate.predictions.cancel(prediction.id) } catch {}
      return { success: false, error: 'Stem split cancelled' }
    }
    await new Promise(r => setTimeout(r, 5000))
    final = await replicate.predictions.get(prediction.id)
    attempts++
  }

  if (final.status !== 'succeeded') {
    return { success: false, error: final.error || 'Stem splitting failed or timed out' }
  }

  // Parse output: grab every key that has an HTTP audio URL (skip nulls/json)
  const raw = final.output ?? final
  const stems: Record<string, string> = {}
  const timestamp = Date.now()

  for (const [key, value] of Object.entries(raw as Record<string, unknown> || {})) {
    if (typeof value === 'string' && value.startsWith('http') && !value.includes('.json')) {
      const name = key.replace(/^(demucs_|mdx_)/, '')
      stems[name] = value
    }
  }

  if (Object.keys(stems).length === 0) {
    return { success: false, error: 'No stems returned. Try a different audio file.' }
  }

  // Download each stem from Replicate and upload to R2 for permanent storage
  const permanentStems: Record<string, string> = {}

  for (const [stemName, replicateUrl] of Object.entries(stems)) {
    try {
      const dlRes = await fetch(replicateUrl)
      if (!dlRes.ok) { permanentStems[stemName] = replicateUrl; continue }
      const buffer = Buffer.from(await dlRes.arrayBuffer())
      const safeName = stemName.replace(/[^a-zA-Z0-9_-]/g, '-')
      const r2Key = `${userId}/stems/${timestamp}-${safeName}.mp3`
      const r2 = await uploadToR2(buffer, 'audio-files', r2Key, 'audio/mpeg')

      if (r2.success && r2.url) {
        permanentStems[stemName] = r2.url

        // Save to combined_media so it appears in library
        const stemTitle = trackTitle !== 'Stem Split'
          ? `${trackTitle} — ${stemName.charAt(0).toUpperCase() + stemName.slice(1)}`
          : `${stemName.charAt(0).toUpperCase() + stemName.slice(1)} (Stem)`

        await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
          method: 'POST',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId, type: 'audio',
            title: stemTitle,
            audio_url: r2.url, is_public: false, genre: 'stem',
            stem_type: stemName.toLowerCase().replace(/\s+\d+$/, ''),
            description: `Stem split from: ${trackTitle}`,
            metadata: JSON.stringify({ source: 'plugin', model: 'harmonix-all' }),
          }),
        })
      } else {
        permanentStems[stemName] = replicateUrl
      }
    } catch {
      permanentStems[stemName] = replicateUrl
    }
  }

  if (Object.keys(permanentStems).length === 0) return { success: false, error: 'No stems could be saved' }

  return { success: true, stems: permanentStems, title: trackTitle }
}

// ──────────────────────────────────────────────────────────────────
// EXTRACT  (single-stem extraction via demucs — for "Extract Audio Stem")
// ──────────────────────────────────────────────────────────────────
async function generateExtract(userId: string, body: Record<string, unknown>, jobId: string, signal: AbortSignal) {
  const audioUrl = body.audioUrl as string
  if (!audioUrl) return { success: false, error: 'audioUrl required' }

  const stem = (body.stem as string) || 'vocals'
  const validStems = ['vocals', 'bass', 'drums', 'piano', 'guitar', 'other']
  if (!validStems.includes(stem)) return { success: false, error: `Invalid stem. Choose: ${validStems.join(', ')}` }

  const output_format = (body.output_format as string) || 'mp3'
  const trackTitle = (body.trackTitle as string) || 'Extracted Audio'
  const effectiveModel = (stem === 'guitar' || stem === 'piano') ? 'htdemucs_6s' : ((body.model_name as string) || 'htdemucs_6s')

  await updatePluginJob(jobId, { status: 'processing' })

  const prediction = await replicate.predictions.create({
    version: '25a173108cff36ef9f80f854c162d01df9e6528be175794b81158fa03836d953',
    input: {
      audio: audioUrl, stem,
      shifts: (body.shifts as number) || 1,
      float32: body.float32 === true,
      overlap: (body.overlap as number) || 0.25,
      clip_mode: (body.clip_mode as string) || 'rescale',
      model_name: effectiveModel,
      mp3_bitrate: (body.mp3_bitrate as number) || 320,
      output_format,
    },
  })

  await updatePluginJob(jobId, { replicatePredictionId: prediction.id })

  let final = prediction
  let attempts = 0
  while (final.status !== 'succeeded' && final.status !== 'failed' && final.status !== 'canceled' && attempts < 36) {
    if (signal.aborted) {
      try { await replicate.predictions.cancel(prediction.id) } catch {}
      return { success: false, error: 'Extraction cancelled' }
    }
    await new Promise(r => setTimeout(r, 5000))
    final = await replicate.predictions.get(prediction.id)
    attempts++
  }

  if (final.status !== 'succeeded') {
    return { success: false, error: final.error || 'Stem extraction failed' }
  }

  const output = final.output as Record<string, string | null>
  const stems: Record<string, string> = {}
  const timestamp = Date.now()

  for (const [stemName, replicateUrl] of Object.entries(output)) {
    if (typeof replicateUrl !== 'string' || !replicateUrl.startsWith('http')) continue

    try {
      const dlRes = await fetch(replicateUrl)
      if (!dlRes.ok) { stems[stemName] = replicateUrl; continue }
      const buffer = Buffer.from(await dlRes.arrayBuffer())
      const r2Key = `${userId}/extract/${timestamp}-${stemName.replace(/[^a-zA-Z0-9_-]/g, '-')}.${output_format}`
      const r2 = await uploadToR2(buffer, 'audio-files', r2Key, `audio/${output_format === 'mp3' ? 'mpeg' : output_format}`)

      if (r2.success && r2.url) {
        stems[stemName] = r2.url
        await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
          method: 'POST',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId, type: 'audio',
            title: `${trackTitle} — ${stemName.charAt(0).toUpperCase() + stemName.slice(1)} Extract`,
            audio_url: r2.url, is_public: false, genre: 'extract',
            description: `${stemName} extracted from: ${trackTitle}`,
            metadata: JSON.stringify({ source: 'plugin', requested_stem: stem, model_name: effectiveModel, output_format }),
          }),
        })
      } else {
        stems[stemName] = replicateUrl
      }
    } catch {
      stems[stemName] = replicateUrl
    }
  }

  if (Object.keys(stems).length === 0) return { success: false, error: 'No stems extracted' }
  return { success: true, stems, requestedStem: stem, title: trackTitle }
}

// ──────────────────────────────────────────────────────────────────
// AUDIO BOOST  (mirrors /api/generate/audio-boost)
// ──────────────────────────────────────────────────────────────────
async function generateAudioBoost(userId: string, body: Record<string, unknown>, jobId: string) {
  const audioUrl = body.audioUrl as string
  if (!audioUrl) return { success: false, error: 'audioUrl required' }

  const bass_boost = (body.bass_boost as number) ?? 0
  const treble_boost = (body.treble_boost as number) ?? 0
  const volume_boost = (body.volume_boost as number) ?? 2
  const normalize = body.normalize !== false
  const noise_reduction = body.noise_reduction === true
  const output_format = (body.output_format as string) || 'mp3'
  const bitrate = (body.bitrate as string) || '192k'
  const trackTitle = (body.trackTitle as string) || 'Boosted Audio'

  await updatePluginJob(jobId, { status: 'processing' })

  const REPLICATE_TOKEN = process.env.REPLICATE_API_KEY_LATEST2!

  const createRes = await fetch('https://api.replicate.com/v1/models/lucataco/audio-boost/predictions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}`, 'Content-Type': 'application/json', 'Prefer': 'wait' },
    body: JSON.stringify({
      input: { audio: audioUrl, bass_boost, treble_boost, volume_boost, normalize, noise_reduction, output_format, bitrate },
    }),
  })

  let prediction = await createRes.json()
  await updatePluginJob(jobId, { replicatePredictionId: prediction.id })

  if (prediction.error) return { success: false, error: `Replicate: ${prediction.error}` }

  let pollAttempts = 0
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled' && pollAttempts < 60) {
    await new Promise(r => setTimeout(r, 1000))
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` },
    })
    prediction = await pollRes.json()
    pollAttempts++
  }

  if (prediction.status !== 'succeeded') return { success: false, error: prediction.error || 'Audio boost failed' }

  const replicateUrl = typeof prediction.output === 'string' ? prediction.output : prediction.output?.url || prediction.output?.[0]
  if (!replicateUrl) return { success: false, error: 'No output from audio boost' }

  // Upload to R2
  const dlRes = await fetch(replicateUrl)
  if (!dlRes.ok) return { success: false, error: 'Failed to download boosted audio' }
  const buffer = Buffer.from(await dlRes.arrayBuffer())
  const r2Key = `${userId}/boosted-${Date.now()}.${output_format}`
  const r2 = await uploadToR2(buffer, 'audio-files', r2Key)
  if (!r2.success) return { success: false, error: 'Failed to save boosted audio' }

  // Save to combined_media
  await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
    method: 'POST',
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId, type: 'audio',
      title: `${trackTitle} (Boosted)`,
      audio_prompt: `Audio Boost: bass=${bass_boost}dB, treble=${treble_boost}dB, vol=${volume_boost}x`,
      prompt: `Audio Boost: bass=${bass_boost}dB, treble=${treble_boost}dB, vol=${volume_boost}x`,
      audio_url: r2.url, is_public: false, genre: 'boosted',
    }),
  })

  return { success: true, audioUrl: r2.url, settings: { bass_boost, treble_boost, volume_boost, normalize, noise_reduction, output_format, bitrate } }
}

// ──────────────────────────────────────────────────────────────────
// VIDEO TO AUDIO  (mirrors /api/generate/video-to-audio)
// ──────────────────────────────────────────────────────────────────
async function generateVideoToAudio(userId: string, body: Record<string, unknown>, jobId: string, signal: AbortSignal) {
  const videoUrl = body.videoUrl as string
  if (!videoUrl) return { success: false, error: 'videoUrl required' }

  const prompt = (body.prompt as string || '').trim()
  if (!prompt) return { success: false, error: 'prompt required — describe the sounds you want' }

  const quality = (body.quality as string) || 'standard'
  const isHQ = quality === 'hq'

  try {
    const urlObj = new URL(videoUrl)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { success: false, error: 'Video URL must use HTTP or HTTPS' }
    }
  } catch {
    return { success: false, error: 'Invalid video URL' }
  }

  await updatePluginJob(jobId, { status: 'processing' })

  const maxRetries = 3
  let output: any = null
  let lastError: string = ''

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (signal.aborted) return { success: false, error: 'Cancelled' }

    try {
      let prediction: any

      if (isHQ) {
        prediction = await replicate.predictions.create({
          model: 'tencent/hunyuanvideo-foley',
          version: '88045928bb97971cffefabfc05a4e55e5bb1c96d475ad4ecc3d229d9169758ae',
          input: { video: videoUrl, prompt, return_audio: false, guidance_scale: 4.5, num_inference_steps: 50 },
        })
      } else {
        prediction = await replicate.predictions.create({
          model: 'zsxkib/mmaudio',
          version: '62871fb59889b2d7c13777f08deb3b36bdff88f7e1d53a50ad7694548a41b484',
          input: { video: videoUrl, prompt, duration: 8, num_steps: 25, cfg_strength: 4.5, negative_prompt: 'music', seed: -1 },
        })
      }

      await updatePluginJob(jobId, { replicatePredictionId: prediction.id })

      let final = prediction
      let pollAttempts = 0
      const maxPoll = isHQ ? 120 : 60

      while (final.status !== 'succeeded' && final.status !== 'failed' && final.status !== 'canceled' && pollAttempts < maxPoll) {
        if (signal.aborted) {
          try { await replicate.predictions.cancel(prediction.id) } catch {}
          return { success: false, error: 'Cancelled' }
        }
        await new Promise(r => setTimeout(r, 1000))
        final = await replicate.predictions.get(prediction.id)
        pollAttempts++
      }

      if (final.status === 'failed') throw new Error(typeof final.error === 'string' ? final.error : 'Generation failed')
      if (final.status !== 'succeeded') throw new Error('Timed out')

      output = final.output
      break
    } catch (err: any) {
      lastError = err.message || 'Generation failed'
      const is502 = lastError.includes('502') || lastError.includes('Bad Gateway')
      if (is502 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 3000))
        continue
      }
      if (attempt === maxRetries) return { success: false, error: lastError }
    }
  }

  if (!output) return { success: false, error: lastError || 'No output' }

  const outputUrl = typeof output === 'string' ? output : output?.url || output?.[0]
  if (!outputUrl) return { success: false, error: 'No output URL from model' }

  // Download and upload to R2
  const dlRes = await fetch(outputUrl)
  if (!dlRes.ok) return { success: false, error: 'Failed to download generated audio' }
  const buffer = Buffer.from(await dlRes.arrayBuffer())
  const r2Key = `${userId}/synced-${Date.now()}.mp4`
  const r2 = await uploadToR2(buffer, 'audio-files', r2Key, 'video/mp4')
  if (!r2.success) return { success: false, error: 'Failed to save to storage' }

  // Save to combined_media
  await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
    method: 'POST',
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId, type: 'video',
      title: `${isHQ ? '[HQ] ' : ''}Video SFX: ${prompt.substring(0, 50)}`,
      prompt, audio_url: r2.url, media_url: r2.url, is_public: false,
    }),
  })

  return { success: true, audioUrl: r2.url, videoUrl: r2.url, prompt, quality, title: `Video SFX: ${prompt.substring(0, 50)}` }
}

// ==================================================================
// HELPERS
// ==================================================================

function extractUrl(output: unknown): string {
  if (typeof output === 'string') return output
  if (output && typeof output === 'object') {
    if ('url' in output && typeof (output as any).url === 'function') return (output as any).url()
    if ('url' in output) return (output as any).url
    if (Array.isArray(output)) {
      const first = output[0]
      if (typeof first === 'string') return first
      if (first && typeof first.url === 'function') return first.url()
      if (first?.url) return first.url
    }
  }
  return ''
}

function expandLyricsForDuration(baseLyrics: string, duration: 'short' | 'medium' | 'long' = 'medium'): string {
  const targets = { short: { min: 200, max: 300 }, medium: { min: 350, max: 500 }, long: { min: 500, max: 600 } }
  const target = targets[duration] || targets.medium
  if (baseLyrics.length >= target.min) return baseLyrics.length > 600 ? baseLyrics.substring(0, 597) + '...' : baseLyrics
  let expanded = baseLyrics
  if (expanded.length < target.min) expanded += `\n\n[Verse 2]\n${baseLyrics}`
  if (expanded.length < target.min) { const chorus = baseLyrics.split('\n').slice(0, 2).join('\n'); expanded += `\n\n[Chorus]\n${chorus}` }
  if (duration === 'long' && expanded.length < target.min) { const bridge = baseLyrics.split('\n').slice(0, 2).join('\n'); expanded += `\n\n[Bridge]\n${bridge}` }
  if (expanded.length > 600) expanded = expanded.substring(0, 597) + '...'
  return expanded
}

async function generateCoverArtForTrack(userId: string, prompt: string, title: string, genre?: string): Promise<string | null> {
  try {
    const imagePrompt = `${prompt} music album cover art, ${genre || 'electronic'} style, professional music artwork`
    const output = await replicate.run('black-forest-labs/flux-2-klein-9b-base', {
      input: { prompt: imagePrompt, aspect_ratio: '1:1', output_format: 'jpg', output_quality: 95, output_megapixels: '1', guidance: 4, go_fast: true, images: [] },
    })
    let imageUrl = extractUrl(output)
    if (!imageUrl) return null
    const fileName = `${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-cover-${Date.now()}.jpg`
    const r2 = await downloadAndUploadToR2(imageUrl, userId, 'images', fileName)
    return r2.success ? r2.url : null
  } catch { return null }
}
