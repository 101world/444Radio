/**
 * Split Stems API - Separates a song into stems using Replicate
 * Returns a set of stem URLs (e.g., vocals, drums, bass, other, instrumental)
 * The actual keys depend on the configured model's output schema.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { createClient } from '@supabase/supabase-js'

export async function OPTIONS() {
  return handleOptions()
}

type StemsMap = Record<string, string>

function normalizeStems(output: any): StemsMap | null {
  if (!output) return null
  // If already an object map of names -> urls
  if (typeof output === 'object' && !Array.isArray(output)) {
    const map: StemsMap = {}
    for (const [k, v] of Object.entries(output)) {
      if (typeof v === 'string') map[k] = v
      else if (v && typeof (v as any).url === 'string') map[k] = (v as any).url
      else if (v && (v as any).audio && typeof (v as any).audio.download_uri === 'string') map[k] = (v as any).audio.download_uri
    }
    return Object.keys(map).length ? map : null
  }
  // If array of strings or objects with url/audio
  if (Array.isArray(output)) {
    const map: StemsMap = {}
    let idx = 1
    for (const item of output) {
      if (typeof item === 'string') {
        map[`stem${idx++}`] = item
      } else if (item && typeof item === 'object') {
        if (typeof (item as any).url === 'string') map[`stem${idx++}`] = (item as any).url
        else if ((item as any).audio && typeof (item as any).audio.download_uri === 'string') map[`stem${idx++}`] = (item as any).audio.download_uri
      }
    }
    return Object.keys(map).length ? map : null
  }
  if (typeof output === 'string') return { stem1: output }
  return null
}

export async function POST(request: Request) {
  let deductedAmount = 0
  let deductedUserId: string | null = null
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    }

    const token = process.env.REPLICATE_API_KEY_LATEST2
    if (!token) {
      console.error('❌ REPLICATE_API_KEY_LATEST2 is not set in environment variables')
      return corsResponse(NextResponse.json({ success: false, error: 'Missing REPLICATE_API_KEY_LATEST2' }, { status: 500 }))
    }
    
    console.log('✅ Replicate API token found, length:', token.length)

    const body = await request.json().catch(() => null)
    const audioUrl = body?.audioUrl as string | undefined
    const outputFormat = (body?.outputFormat as string | undefined) || (body?.output_format as string | undefined) || 'wav'
    
    if (!audioUrl || typeof audioUrl !== 'string') {
      return corsResponse(NextResponse.json({ success: false, error: 'audioUrl required' }, { status: 400 }))
    }
    
    if (!['mp3', 'wav', 'flac'].includes(outputFormat)) {
      return corsResponse(NextResponse.json({ success: false, error: 'outputFormat must be mp3, wav, or flac' }, { status: 400 }))
    }

    // Extract advanced params with safe defaults
    // Valid models: htdemucs (Core) and htdemucs_6s (Extended)
    const VALID_MODELS = ['htdemucs', 'htdemucs_6s'] as const
    const demucsModel = VALID_MODELS.includes(body?.model as any) ? (body.model as string) : 'htdemucs'
    const wavFormat = (['int16', 'int24', 'float32'].includes(body?.wav_format) ? body.wav_format : 'int24') as string
    const clipMode = (['rescale', 'clamp'].includes(body?.clip_mode) ? body.clip_mode : 'rescale') as string
    const shifts = typeof body?.shifts === 'number' && body.shifts >= 1 && body.shifts <= 10 ? body.shifts : 1
    const overlap = typeof body?.overlap === 'number' && body.overlap >= 0 && body.overlap <= 0.99 ? body.overlap : 0.25
    const mp3Bitrate = typeof body?.mp3_bitrate === 'number' && body.mp3_bitrate >= 64 && body.mp3_bitrate <= 320 ? body.mp3_bitrate : 320
    const mp3Preset = typeof body?.mp3_preset === 'number' && body.mp3_preset >= 2 && body.mp3_preset <= 9 ? body.mp3_preset : 2
    const splitAudio = typeof body?.split === 'boolean' ? body.split : true
    const segment = typeof body?.segment === 'number' && body.segment > 0 ? body.segment : undefined
    const jobs = 0 // Locked to 0 (auto) — prevents abuse of parallel jobs

    // Display names for Demucs models (used in transaction descriptions)
    const MODEL_DISPLAY_NAMES: Record<string, string> = {
      htdemucs: '444 Core',
      htdemucs_6s: '444 Extended',
    }

    /**
     * Credit cost per stem:
     * - 444 Core (htdemucs): FREE for int16/int24 WAV, 1 credit for float32/mp3/flac
     * - 444 Extended (htdemucs_6s): always 1 credit per stem
     * - 444 Heat handled separately at 5 credits flat (not used in studio route)
     */
    const isCoreFree = demucsModel !== 'htdemucs_6s' && outputFormat === 'wav' && wavFormat !== 'float32'
    const stemCost = isCoreFree ? 0 : 1
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single()

    if (userError || !userData) {
      return corsResponse(NextResponse.json({ success: false, error: 'User not found' }, { status: 404 }))
    }

    if (stemCost > 0 && userData.credits < stemCost) {
      return corsResponse(NextResponse.json({
        success: false,
        error: `Insufficient credits. Stem split requires ${stemCost} credit${stemCost > 1 ? 's' : ''}, you have ${userData.credits}.`,
        creditsNeeded: stemCost,
        creditsAvailable: userData.credits
      }, { status: 402 }))
    }

    // ✅ DEDUCT credits atomically BEFORE generation (skip if free tier)
    if (stemCost > 0) {
      const { data: deductResultRaw } = await supabase
        .rpc('deduct_credits', { p_clerk_user_id: userId, p_amount: stemCost, p_type: 'generation_stem_split', p_description: `Stem Split (${MODEL_DISPLAY_NAMES[demucsModel] || demucsModel}) [${wavFormat}]` })
        .single()
      const deductResult = deductResultRaw as { success: boolean; new_credits: number; error_message?: string | null } | null
      if (!deductResult?.success) {
        const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
        console.error('❌ Credit deduction blocked:', errorMsg)
        await logCreditTransaction({ userId, amount: -stemCost, type: 'generation_stem_split', status: 'failed', description: `Stem Split (${MODEL_DISPLAY_NAMES[demucsModel] || demucsModel}) [${wavFormat}]`, metadata: {} })
        return corsResponse(NextResponse.json({ success: false, error: errorMsg }, { status: 402 }))
      }
      console.log(`✅ Credits deducted: ${stemCost}. Remaining: ${deductResult.new_credits}`)
      deductedAmount = stemCost
      deductedUserId = userId
      await logCreditTransaction({ userId, amount: -stemCost, balanceAfter: deductResult.new_credits, type: 'generation_stem_split', description: `Stem Split (${MODEL_DISPLAY_NAMES[demucsModel] || demucsModel}) [${wavFormat}]`, metadata: { model: demucsModel, cost: stemCost, wav_format: wavFormat } })
    } else {
      // Free generation — still log it for tracking
      console.log(`🆓 Free stem split (${MODEL_DISPLAY_NAMES[demucsModel] || demucsModel}) [${outputFormat}/${wavFormat}]`)
      await logCreditTransaction({ userId, amount: 0, balanceAfter: userData.credits, type: 'generation_stem_split', description: `Stem Split (FREE): ${MODEL_DISPLAY_NAMES[demucsModel] || demucsModel} [${outputFormat}/${wavFormat}]`, metadata: { model: demucsModel, cost: 0, wav_format: wavFormat, output_format: outputFormat, free: true } })
    }

    console.log('🎵 Stem splitting requested by user:', userId)

    // Use ryan5453/demucs model — htdemucs_6s with 6-stem support (WAV output)
    const DEMUCS_VERSION = '5a7041cc9b82e5a558fea6b3d7b12dea89625e89da33f0447bd727c2d0ab9e77'
    const replicate = new Replicate({ auth: token })

    // Accept optional stem parameter for per-stem isolation
    const stem = (body?.stem as string | undefined) || 'none'

    let prediction: any
    let lastError: any = null

    // Attempt prediction creation with retry+backoff for transient errors
    const MAX_ATTEMPTS = 3
    const BASE_DELAY_MS = 1000
    let attempt = 0
    const createPrediction = async () => {
      attempt++
      try {
        console.log('🎵 Starting stem separation (attempt', attempt, ')', { audioUrl, outputFormat, stem, model: demucsModel })
        const demucsInput: Record<string, unknown> = {
            audio: audioUrl,
            model: demucsModel,
            stem: stem,
            output_format: outputFormat,
            wav_format: wavFormat,
            clip_mode: clipMode,
            shifts,
            overlap,
            mp3_bitrate: mp3Bitrate,
            mp3_preset: mp3Preset,
            split: splitAudio,
            jobs,
        }
        if (segment !== undefined) demucsInput.segment = segment

        const resp = await replicate.predictions.create({
          version: DEMUCS_VERSION,
          input: demucsInput,
        })
        console.log('✅ Prediction created:', resp?.id)
        return resp
      } catch (e: any) {
        lastError = e
        const status = e?.response?.status
        console.error(`❌ Demucs stem separation error (attempt ${attempt}):`, {
          message: e?.message,
          status,
          statusText: e?.response?.statusText,
          data: e?.response?.data,
          stack: e?.stack,
        })

        // For 4xx errors (client), don't retry except for 429 (rate limit)
        if (status && status >= 400 && status < 500 && status !== 429) {
          throw e
        }

        if (attempt < MAX_ATTEMPTS) {
          const wait = BASE_DELAY_MS * Math.pow(2, attempt - 1)
          console.log(`⏳ Retrying in ${wait}ms...`)
          await new Promise((r) => setTimeout(r, wait))
          return createPrediction()
        }
        // else fall through to return undefined / throw
        throw e
      }
    }

    try {
      prediction = await createPrediction()
    } catch (e) {
      // Non-retryable error or repeated failures
      lastError = e
      console.error('❌ Demucs stem separation final error:', e)
    }

    if (!prediction) {
      const errorMsg = lastError?.message || lastError?.toString() || 'Unknown error'
      console.error('❌ Stem separation failed:', errorMsg)
      await refundCredits({ userId, amount: stemCost, type: 'generation_stem_split', reason: `Stem separation failed (no prediction): ${errorMsg.substring(0, 80)}`, metadata: { model: demucsModel, error: errorMsg.substring(0, 200) } }).catch(() => {})
      return corsResponse(NextResponse.json({ 
        success: false, 
        error: 'Stem separation is temporarily unavailable. This feature requires specific AI models that may be under maintenance.', 
        detail: errorMsg 
      }, { status: 503 }))
    }

    // Poll for completion up to 60s — cancel prediction if exceeded to stop billing
    const start = Date.now()
    const TIMEOUT_MS = 60000 // 60 seconds hard limit
    const POLL_INTERVAL_MS = 3000 // Poll every 3 seconds
    let result = prediction
    let pollAttempts = 0
    
    while (result && result.status && result.status !== 'succeeded' && result.status !== 'failed' && result.status !== 'canceled') {
      pollAttempts++
      const elapsed = Date.now() - start
      
      if (elapsed > TIMEOUT_MS) {
        console.error(`❌ Stem separation timeout after ${elapsed}ms, cancelling prediction: ${result.id}`)
        // Cancel the prediction to stop Replicate billing
        try { await replicate.predictions.cancel(result.id) } catch (cancelErr) {
          console.error('❌ Failed to cancel prediction:', cancelErr)
        }
        await refundCredits({ userId, amount: stemCost, type: 'generation_stem_split', reason: `Stem split timed out after 60s`, metadata: { model: demucsModel, predictionId: result.id } }).catch(() => {})
        return corsResponse(NextResponse.json({ 
          success: false, 
          error: 'Stem separation timed out after 60 seconds. The AI model may be overloaded — please try again later.',
          predictionId: result.id
        }, { status: 408 }))
      }
      
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      
      try {
        result = await replicate.predictions.get(result.id)
        console.log(`🔄 Poll attempt ${pollAttempts}: status=${result.status}, elapsed=${Math.round(elapsed/1000)}s`)
      } catch (pollError: any) {
        console.error(`⚠️ Error polling prediction (attempt ${pollAttempts}):`, pollError?.message)
        // On poll error, retry with exponential backoff
        if (pollAttempts < 5) {
          await new Promise(r => setTimeout(r, POLL_INTERVAL_MS * 2))
          continue
        }
        // After 5 poll failures, give up
        await refundCredits({ userId, amount: stemCost, type: 'generation_stem_split', reason: 'Stem split poll failures', metadata: { model: demucsModel, pollAttempts } }).catch(() => {})
        return corsResponse(NextResponse.json({ 
          success: false, 
          error: 'Unable to check stem separation status. Please try again.',
          detail: pollError?.message
        }, { status: 503 }))
      }
    }

    if (result.status === 'failed') {
      console.error('❌ Demucs prediction failed:', result.error)
      await refundCredits({ userId, amount: stemCost, type: 'generation_stem_split', reason: `Stem split failed: ${String(result.error).substring(0, 80)}`, metadata: { model: demucsModel, predictionId: result.id } }).catch(() => {})
      return corsResponse(NextResponse.json({ 
        success: false, 
        error: `Stem separation failed: ${result.error || 'Unknown error from AI model'}`,
        predictionId: result.id
      }, { status: 500 }))
    }
    
    if (result.status === 'canceled') {
      console.error('\u274c Demucs prediction canceled')
      await refundCredits({ userId, amount: stemCost, type: 'generation_stem_split', reason: 'Stem split cancelled', metadata: { model: demucsModel, predictionId: result.id } }).catch(() => {})
      return corsResponse(NextResponse.json({ 
        success: false, 
        error: 'Stem separation was canceled',
        predictionId: result.id
      }, { status: 500 }))
    }

    const stems = normalizeStems(result.output)
    if (!stems || Object.keys(stems).length === 0) {
      console.error('❌ No stems in output:', result.output)
      await refundCredits({ userId, amount: stemCost, type: 'generation_stem_split', reason: 'No stems in output', metadata: { model: demucsModel, predictionId: result.id } }).catch(() => {})
      return corsResponse(NextResponse.json({ 
        success: false, 
        error: 'AI model returned no stems. This may be due to audio format or quality issues.',
        raw: result.output,
        predictionId: result.id
      }, { status: 502 }))
    }

    console.log(`✅ Stem separation complete: ${Object.keys(stems).length} stems extracted`)
    // Do not upload stems to R2 here; return direct URLs for immediate placement
    return corsResponse(NextResponse.json({ success: true, stems, predictionId: result.id }))
  } catch (error: any) {
    console.error('❌ Split-stems critical error:', {
      message: error?.message,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      stack: error?.stack
    })
    
    // Refund if credits were already deducted
    if (deductedAmount > 0 && deductedUserId) {
      await refundCredits({ userId: deductedUserId, amount: deductedAmount, type: 'generation_stem_split', reason: `Split-stems critical error: ${error?.message?.substring(0, 80) || 'unknown'}`, metadata: { error: String(error).substring(0, 200) } }).catch(() => {})
    }
    
    // Provide helpful error messages based on status code
    let userMessage = 'An error occurred during stem separation. Please try again.'
    const status = error?.response?.status
    
    if (status === 402) {
      userMessage = 'Unable to process: Replicate billing issue. Please contact support.'
    } else if (status === 503 || status === 504) {
      userMessage = 'The AI service is temporarily unavailable due to high demand. Please try again in a few minutes.'
    } else if (status === 429) {
      userMessage = 'Rate limit exceeded. Please wait a moment and try again.'
    } else if (status >= 500) {
      userMessage = 'The AI service encountered an error. Please try again.'
    }
    
    return corsResponse(NextResponse.json({ 
      success: false, 
      error: userMessage,
      detail: error instanceof Error ? error.message : String(error),
      statusCode: status
    }, { status: status || 500 }))
  }
}
