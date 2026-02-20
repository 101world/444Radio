import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { createClient } from '@supabase/supabase-js'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { uploadToR2 } from '@/lib/r2-upload'

export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Credit cost per stem:
 * - 444 Core (htdemucs): FREE for int16/int24 WAV, 1 credit for float32/mp3/flac
 * - 444 Extended (htdemucs_6s): always 1 credit per stem
 * - 444 Heat (all stems): always 5 credits flat (handled separately)
 */
function getStemCost(model: string, outputFormat: string, wavFormat?: string): number {
  // Extended always costs 1 credit per stem
  if (model === 'htdemucs_6s') return 1
  // Core: free only for int16/int24 WAV output; mp3/flac/float32 = 1 credit
  if (outputFormat === 'mp3' || outputFormat === 'flac') return 1
  if (wavFormat === 'float32') return 1
  return 0 // Core with int16/int24 WAV is free
}

// Display names for Demucs models (used in transaction descriptions)
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  htdemucs: '444 Core',
  htdemucs_6s: '444 Extended',
}

// Valid stem choices (maps UI labels → Demucs stem parameter)
const VALID_STEMS = ['drums', 'bass', 'vocals', 'guitar', 'piano', 'other'] as const
type StemChoice = typeof VALID_STEMS[number]

// Demucs model version — ryan5453/demucs latest (htdemucs_6s with 6-stem support)
const DEMUCS_VERSION = '5a7041cc9b82e5a558fea6b3d7b12dea89625e89da33f0447bd727c2d0ab9e77'

// Helper to refund stem credits for failed earn purchases
async function refundEarnStemCredits(userId: string, earnJobId: string, reason: string, cost: number = 1) {
  try {
    await supabase.from('earn_split_jobs').update({ status: 'failed' }).eq('id', earnJobId)
    const { data: refundUser } = await supabase.from('users').select('credits').eq('clerk_user_id', userId).single()
    const refundedCredits = (refundUser?.credits || 0) + cost
    await supabase.from('users').update({ credits: refundedCredits }).eq('clerk_user_id', userId)
    await logCreditTransaction({ userId, amount: cost, balanceAfter: refundedCredits, type: 'credit_refund', description: `Stem split ${reason} — refunded ${cost} credit${cost > 1 ? 's' : ''}`, metadata: { earnJobId, reason } })
    console.log(`[Stem Split] Refunded ${cost} credit${cost > 1 ? 's' : ''} to ${userId} (reason: ${reason})`)
  } catch (refundErr) {
    console.error('[Stem Split] Refund failed:', refundErr)
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      audioUrl,
      stem,
      earnJobId,
      // Advanced params from modal (with safe defaults)
      model: requestedModel,
      output_format: requestedOutputFormat,
      mp3_bitrate: requestedMp3Bitrate,
      mp3_preset: requestedMp3Preset,
      wav_format: requestedWavFormat,
      clip_mode: requestedClipMode,
      shifts: requestedShifts,
      overlap: requestedOverlap,
      split: requestedSplit,
      segment: requestedSegment,
      jobs: requestedJobs,
    } = body as {
      audioUrl?: string; stem?: string; earnJobId?: string;
      model?: string; output_format?: string; mp3_bitrate?: number; mp3_preset?: number;
      wav_format?: string; clip_mode?: string; shifts?: number; overlap?: number;
      split?: boolean; segment?: number; jobs?: number;
    }

    // Validate and apply advanced params with safe defaults
    // For earn purchases, default to 444 Heat (htdemucs_6s) model
    const VALID_MODELS = ['htdemucs', 'htdemucs_6s'] as const
    const defaultModel = earnJobId ? 'htdemucs_6s' : 'htdemucs'  // Earn jobs use 444 Heat
    const demucsModel = VALID_MODELS.includes(requestedModel as any) ? requestedModel as string : defaultModel
    const outputFormat = (['wav', 'mp3', 'flac'].includes(requestedOutputFormat || '') ? requestedOutputFormat : 'wav') as string
    const mp3Bitrate = typeof requestedMp3Bitrate === 'number' && requestedMp3Bitrate >= 64 && requestedMp3Bitrate <= 320 ? requestedMp3Bitrate : 320
    const mp3Preset = typeof requestedMp3Preset === 'number' && requestedMp3Preset >= 2 && requestedMp3Preset <= 9 ? requestedMp3Preset : 2
    const wavFormat = (['int16', 'int24', 'float32'].includes(requestedWavFormat || '') ? requestedWavFormat : 'int24') as string
    const clipMode = (['rescale', 'clamp'].includes(requestedClipMode || '') ? requestedClipMode : 'rescale') as string
    const shifts = typeof requestedShifts === 'number' && requestedShifts >= 1 && requestedShifts <= 10 ? requestedShifts : 1
    const overlap = typeof requestedOverlap === 'number' && requestedOverlap >= 0 && requestedOverlap <= 0.99 ? requestedOverlap : 0.25
    const splitAudio = typeof requestedSplit === 'boolean' ? requestedSplit : true
    const segment = typeof requestedSegment === 'number' && requestedSegment > 0 ? requestedSegment : undefined
    const jobs = 0 // Locked to 0 (auto) — prevents abuse of parallel jobs

    // Determine valid stems for the chosen model
    const SIX_STEM_MODELS = ['htdemucs_6s']
    const validStemsForModel = SIX_STEM_MODELS.includes(demucsModel)
      ? VALID_STEMS
      : (['drums', 'bass', 'vocals', 'other'] as const)

    if (!audioUrl) {
      return NextResponse.json({ error: 'Audio URL required' }, { status: 400 })
    }

    // Validate stem choice for the chosen model
    // For earn purchases, default to 'all' (444 Heat extracts all stems)
    const defaultStem = earnJobId ? 'all' : undefined
    const finalStem = stem || defaultStem
    const validStemsList = validStemsForModel as readonly string[]
    if (!finalStem || (finalStem !== 'all' && !validStemsList.includes(finalStem))) {
      return NextResponse.json({ 
        error: `Invalid stem for ${demucsModel}. Choose one of: ${validStemsForModel.join(', ')}, all` 
      }, { status: 400 })
    }

    // If earnJobId is provided, this was already paid for via earn purchase — skip credit deduction
    let skipCreditDeduction = false
    if (earnJobId) {
      const { data: job, error: jobErr } = await supabase
        .from('earn_split_jobs')
        .select('id, user_id, status')
        .eq('id', earnJobId)
        .eq('user_id', userId)
        .eq('status', 'queued')
        .single()

      if (jobErr || !job) {
        return NextResponse.json({ error: 'Invalid or already processed stem split job' }, { status: 400 })
      }

      // Mark as processing so it can't be reused
      await supabase.from('earn_split_jobs').update({ status: 'processing' }).eq('id', earnJobId)
      skipCreditDeduction = true
    }

    // Try to find the parent track in combined_media by audio_url
    const { data: parentTrack } = await supabase
      .from('combined_media')
      .select('id, title, image_url')
      .eq('audio_url', audioUrl)
      .maybeSingle()

    // Check credits
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const HEAT_COST = 5 // 444 Heat is always 5 credits flat
    const perStemCost = getStemCost(demucsModel, outputFormat, wavFormat)
    const stemCost = finalStem === 'all' ? HEAT_COST : perStemCost
    if (!skipCreditDeduction && stemCost > 0 && userData.credits < stemCost) {
      return NextResponse.json({ 
        error: `Insufficient credits. Need ${stemCost} credit${stemCost > 1 ? 's' : ''} but have ${userData.credits}` 
      }, { status: 402 })
    }

    // ✅ DEDUCT credits atomically BEFORE generation (skip if earn-purchased or free tier)
    let deductResult: { success: boolean; new_credits: number; error_message?: string | null } | null = null
    if (!skipCreditDeduction && stemCost > 0) {
      const rpcLabel = finalStem === 'all' ? '444 Heat' : `${finalStem} (${MODEL_DISPLAY_NAMES[demucsModel] || demucsModel})`
      const { data: deductResultRaw } = await supabase
        .rpc('deduct_credits', { p_clerk_user_id: userId, p_amount: stemCost, p_type: 'generation_stem_split', p_description: `Stem Split: ${rpcLabel} [${wavFormat}]` })
        .single()
      deductResult = deductResultRaw as { success: boolean; new_credits: number; error_message?: string | null } | null
      if (!deductResult?.success) {
        const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
        console.error('❌ Credit deduction blocked:', errorMsg)
        return NextResponse.json({ error: errorMsg }, { status: 402 })
      }
      console.log(`✅ Credits deducted: ${stemCost}. Remaining: ${deductResult.new_credits}`)
      // Log the deduction to credit_transactions
      const txnLabel = finalStem === 'all' ? '444 Heat' : `${finalStem} (${MODEL_DISPLAY_NAMES[demucsModel] || demucsModel})`
      await logCreditTransaction({
        userId, amount: -stemCost, balanceAfter: deductResult.new_credits,
        type: 'generation_stem_split',
        description: `Stem Split: ${txnLabel} [${outputFormat}/${wavFormat}]`,
        metadata: { stem: finalStem, model: demucsModel, cost: stemCost, wav_format: wavFormat, output_format: outputFormat },
      })
    } else {
      // Free generation — still log it for tracking
      console.log(`🆓 Free stem split: ${finalStem} (${MODEL_DISPLAY_NAMES[demucsModel] || demucsModel}) [${outputFormat}/${wavFormat}]`)
      await logCreditTransaction({
        userId, amount: 0, balanceAfter: userData.credits,
        type: 'generation_stem_split',
        description: `Stem Split (FREE): ${finalStem} (${MODEL_DISPLAY_NAMES[demucsModel] || demucsModel}) [${outputFormat}/${wavFormat}]`,
        metadata: { stem: finalStem, model: demucsModel, cost: 0, wav_format: wavFormat, output_format: outputFormat, free: true },
      })
    }

    // Stream prediction ID to client for cancellation, then process result
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    const sendLine = async (data: Record<string, unknown>) => {
      await writer.write(encoder.encode(JSON.stringify(data) + '\n'))
    }

    // Capture request signal for client disconnect detection
    const requestSignal = request.signal

    // Return streaming response IMMEDIATELY — do all slow work inside the IIFE
    ;(async () => {
      try {
        // Send initial heartbeat so client knows the stream is alive
        await sendLine({ type: 'progress', status: 'starting', elapsed: 0 })

        // Create Replicate prediction with ryan5453/demucs
        // Model supports per-stem isolation: drums, bass, vocals (+ guitar, piano for 6s), other
        const demucsInput: Record<string, unknown> = {
            audio: audioUrl,
            model: demucsModel,
            stem: finalStem === 'all' ? 'none' : finalStem,  // 'none' returns all stems; 'other' isolates instrumental
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

        const prediction = await replicate.predictions.create({
          version: DEMUCS_VERSION,
          input: demucsInput,
        })

        await sendLine({ type: 'started', predictionId: prediction.id })

        // Poll for result — 120s hard timeout for WAV processing
        let finalPrediction = prediction
        let attempts = 0
        const MAX_POLL_ATTEMPTS = 24 // 24 × 5s = 120s max
        while (
          finalPrediction.status !== 'succeeded' &&
          finalPrediction.status !== 'failed' &&
          finalPrediction.status !== 'canceled' &&
          attempts < MAX_POLL_ATTEMPTS
        ) {
          if (requestSignal.aborted) {
            console.log('[Stem Split] Client disconnected, cancelling:', prediction.id)
            try { await replicate.predictions.cancel(prediction.id) } catch {}
            if (skipCreditDeduction && earnJobId) {
              await refundEarnStemCredits(userId, earnJobId, 'client_disconnected')
            }
            if (!skipCreditDeduction) {
              await refundCredits({ userId, amount: stemCost, type: 'generation_stem_split', reason: `Stem split cancelled (client disconnected): ${finalStem}`, metadata: { reason: 'client_disconnected' } })
            }
            await sendLine({ type: 'result', success: false, error: 'Stem split cancelled', refunded: true }).catch(() => {})
            await writer.close().catch(() => {})
            return
          }
          await new Promise(resolve => setTimeout(resolve, 5000))
          finalPrediction = await replicate.predictions.get(prediction.id)
          attempts++
          // Heartbeat every poll to prevent Vercel 504 gateway timeout
          await sendLine({ type: 'progress', status: finalPrediction.status, elapsed: attempts * 5 }).catch(() => {})
        }

        // If timed out, cancel the prediction to stop billing
        if (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && finalPrediction.status !== 'canceled') {
          console.log(`[Stem Split] ⏰ Timeout after ${attempts * 5}s, cancelling prediction:`, prediction.id)
          try { await replicate.predictions.cancel(prediction.id) } catch (cancelErr) {
            console.error('[Stem Split] Failed to cancel prediction:', cancelErr)
          }
          if (skipCreditDeduction && earnJobId) {
            await refundEarnStemCredits(userId, earnJobId, 'timeout')
          }
          if (!skipCreditDeduction) {
            await refundCredits({ userId, amount: stemCost, type: 'generation_stem_split', reason: `Stem split timed out: ${finalStem}`, metadata: { reason: 'timeout', predictionId: prediction.id } })
          }
          await sendLine({ type: 'result', success: false, error: 'Stem splitting timed out. The model may be overloaded — please try again later.', refunded: true })
          await writer.close()
          return
        }

        if (finalPrediction.status === 'canceled') {
          if (skipCreditDeduction && earnJobId) {
            await refundEarnStemCredits(userId, earnJobId, 'canceled')
          }
          if (!skipCreditDeduction) {
            await refundCredits({ userId, amount: stemCost, type: 'generation_stem_split', reason: `Stem split cancelled: ${finalStem}`, metadata: { reason: 'canceled' } })
          }
          await sendLine({ type: 'result', success: false, error: 'Stem split cancelled', refunded: true })
          await writer.close()
          return
        }

        if (finalPrediction.status !== 'succeeded') {
          if (skipCreditDeduction && earnJobId) {
            await refundEarnStemCredits(userId, earnJobId, 'failed')
          }
          if (!skipCreditDeduction) {
            await refundCredits({ userId, amount: stemCost, type: 'generation_stem_split', reason: `Stem split failed: ${finalStem}`, metadata: { reason: 'failed' } })
          }
          await sendLine({ type: 'result', success: false, error: 'Stem split failed', refunded: true })
          await writer.close()
          return
        }

        // Extract the requested stem URL from output
        // Demucs returns: { bass, drums, guitar, other, piano, vocals } — each key is url or null
        // No output — refund
        const raw = finalPrediction.output as Record<string, string | null> | null
        if (!raw) {
          if (!skipCreditDeduction) {
            await refundCredits({ userId, amount: stemCost, type: 'generation_stem_split', reason: `Stem split: no output for ${finalStem}`, metadata: {} })
          }
          await sendLine({ type: 'result', success: false, error: 'No output returned from model.', refunded: true })
          await writer.close()
          return
        }

        // Collect only non-null stem URLs from the output
        // When a SPECIFIC stem is requested (not 'other'/'none'), Demucs returns the
        // requested stem + a residual "other" track.  We only keep the requested stem
        // to avoid duplicating rows in the library and confusing the UI.
        const outputStems: Record<string, string> = {}
        for (const [key, value] of Object.entries(raw)) {
          if (typeof value === 'string' && value.startsWith('http')) {
            // If a specific stem was requested, skip the residual "other" output
            if (finalStem !== 'other' && finalStem !== 'none' && finalStem !== 'all' && key === 'other') {
              console.log(`[Stem Split] Skipping residual "other" output (user requested: ${finalStem})`)
              continue
            }
            outputStems[key] = value
          }
        }

        if (Object.keys(outputStems).length === 0) {
          if (!skipCreditDeduction) {
            await refundCredits({ userId, amount: stemCost, type: 'generation_stem_split', reason: `Stem split: no stems returned for ${finalStem}`, metadata: {} })
          }
          await sendLine({ type: 'result', success: false, error: 'No stems returned. Try a different audio file.', refunded: true })
          await writer.close()
          return
        }

        // Download each returned stem from Replicate and upload to R2 for permanent storage
        await sendLine({ type: 'progress', status: 'uploading', elapsed: attempts * 5 + 1 }).catch(() => {})
        const permanentStems: Record<string, string> = {}
        const savedLibraryIds: string[] = []
        const timestamp = Date.now()

        for (const [stemName, replicateUrl] of Object.entries(outputStems)) {
          try {
            const dlRes = await fetch(replicateUrl)
            if (!dlRes.ok) {
              console.error(`[Stem Split] Failed to download ${stemName}:`, dlRes.status)
              permanentStems[stemName] = replicateUrl // fallback to temp URL
              continue
            }
            const buffer = Buffer.from(await dlRes.arrayBuffer())
            const safeName = stemName.replace(/[^a-zA-Z0-9_-]/g, '-')
            const fileExt = outputFormat === 'mp3' ? 'mp3' : outputFormat === 'flac' ? 'flac' : 'wav'
            const mimeType = outputFormat === 'mp3' ? 'audio/mpeg' : outputFormat === 'flac' ? 'audio/flac' : 'audio/wav'
            const r2Key = `${userId}/stems/${timestamp}-${safeName}.${fileExt}`

            const r2Result = await uploadToR2(buffer, 'audio-files', r2Key, mimeType)
            if (r2Result.success && r2Result.url) {
              permanentStems[stemName] = r2Result.url
              console.log(`[Stem Split] ✅ ${stemName} → R2:`, r2Result.url)

              // Save to combined_media so it appears in library
              const stemTitle = parentTrack?.title 
                ? `${parentTrack.title} — ${stemName.charAt(0).toUpperCase() + stemName.slice(1)}`
                : `${stemName.charAt(0).toUpperCase() + stemName.slice(1)} (Stem)`
              const { data: saved, error: saveErr } = await supabase
                .from('combined_media')
                .insert({
                  user_id: userId,
                  type: 'audio',
                  title: stemTitle,
                  audio_url: r2Result.url,
                  image_url: parentTrack?.image_url || null,
                  is_public: false,
                  genre: 'stem',  // Marks as stem in library
                  stem_type: stemName.toLowerCase().replace(/\s+\d+$/, ''),
                  parent_track_id: parentTrack?.id || null,
                  description: `Stem split (${finalStem}) from: ${parentTrack?.title || audioUrl}`,
                })
                .select('id')
                .single()

              if (saved?.id) {
                savedLibraryIds.push(saved.id)
                
                // Send chat message for this stem (so it appears in Create page chat)
                try {
                  await supabase
                    .from('chat_messages')
                    .insert({
                      clerk_user_id: userId,
                      message_type: 'assistant',
                      content: `🎵 **${stemTitle}** stem extracted and saved to your library`,
                      generation_type: 'stem_split',
                      generation_id: saved.id,
                      result: {
                        title: stemTitle,
                        audioUrl: r2Result.url,
                        stemType: stemName,
                        parentTrack: parentTrack?.title || 'Unknown',
                        savedToLibrary: true,
                        libraryId: saved.id,
                      }
                    })
                  console.log(`[Stem Split] ✅ Chat message sent for ${stemName}`)
                } catch (chatErr) {
                  console.error(`[Stem Split] Failed to send chat message for ${stemName}:`, chatErr)
                }
              } else if (saveErr) {
                console.error(`[Stem Split] Library save error for ${stemName}:`, saveErr.message)
              }
            } else {
              permanentStems[stemName] = replicateUrl // fallback
              console.error(`[Stem Split] R2 upload failed for ${stemName}`)
            }
          } catch (err) {
            console.error(`[Stem Split] Error persisting ${stemName}:`, err)
            permanentStems[stemName] = replicateUrl // fallback
          }
        }

        await sendLine({
          type: 'result',
          success: true,
          stem: finalStem,
          stems: permanentStems,
          libraryIds: savedLibraryIds,
          creditsUsed: stemCost,
          creditsRemaining: skipCreditDeduction ? userData.credits : (deductResult?.new_credits ?? userData.credits),
          model: demucsModel,
          outputFormat: outputFormat,
        })

        // Mark earn job completed if applicable
        if (skipCreditDeduction && earnJobId) {
          await supabase.from('earn_split_jobs').update({ status: 'completed' }).eq('id', earnJobId)
        }

        await writer.close()
      } catch (error) {
        console.error('[Stem Split] Stream error:', error)
        // If this was an earn purchase, refund the stem cost and mark job failed
        if (skipCreditDeduction && earnJobId) {
          try {
            await supabase.from('earn_split_jobs').update({ status: 'failed' }).eq('id', earnJobId)
            const { data: refundUser } = await supabase.from('users').select('credits').eq('clerk_user_id', userId).single()
            const refundedCredits = (refundUser?.credits || 0) + stemCost
            await supabase.from('users').update({ credits: refundedCredits }).eq('clerk_user_id', userId)
            await logCreditTransaction({ userId, amount: stemCost, balanceAfter: refundedCredits, type: 'credit_refund', description: `Stem split failed — refunded ${stemCost} credit${stemCost > 1 ? 's' : ''}`, metadata: { earnJobId, error: String(error).substring(0, 200) } })
            console.log(`[Stem Split] Refunded ${stemCost} credit${stemCost > 1 ? 's' : ''} to ${userId} for failed stem split`)
          } catch (refundErr) {
            console.error('[Stem Split] Refund failed:', refundErr)
          }
        }
        // Refund credits for non-earn failures
        if (!skipCreditDeduction) {
            await refundCredits({ userId, amount: stemCost, type: 'generation_stem_split', reason: `Stem split stream error: ${finalStem}`, metadata: { error: String(error).substring(0, 200) } })
        }
        try {
          await sendLine({ type: 'result', success: false, error: '444 radio is locking in, please try again in few minutes', refunded: true })
          await writer.close()
        } catch { /* stream may already be closed */ }
      }
    })()

    return new Response(stream.readable, {
      headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' }
    })
  } catch (error) {
    console.error('[Stem Split] Error:', error)
    return NextResponse.json({ 
      error: '444 radio is locking in, please try again in few minutes'
    }, { status: 500 })
  }
}
