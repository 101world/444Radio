import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/hybrid-auth'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'

// Allow up to 5 minutes for lip-sync video generation (Vercel Pro limit: 300s)
export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Credit cost for Wan 2.6 I2V lip-sync generation.
 * 1 credit = $0.035 | 50% profit margin (charge = cost × 1.5)
 *
 * Wan 2.6 I2V Replicate cost (image+audio to video):
 * Note: Model ONLY supports 720p and 1080p (480p not supported)
 *   Resolution │ Cost per second of output video
 *   ───────────┼────────────────────────────────
 *     720p     │  $0.10/s
 *    1080p     │  $0.15/s
 *
 * Charge (cost × 1.5), then credits = ceil(dur × charge / 0.035):
 *   Duration │  720p │ 1080p
 *   ─────────┼───────┼───────
 *      2s    │    9  │   13
 *      5s    │   22  │   33
 *      8s    │   35  │   52
 *     10s    │   43  │   65
 *
 * Note: Model supports up to 10 seconds max duration for lip-sync mode.
 */
const REPLICATE_COST_PER_SECOND: Record<string, number> = {
  '720p': 0.10,
  '1080p': 0.15,
}
const PROFIT_MARGIN = 1.5
const CREDIT_VALUE = 0.035

function calculateCredits(durationSeconds: number, resolution: string): number {
  const costPerSec = REPLICATE_COST_PER_SECOND[resolution] || REPLICATE_COST_PER_SECOND['720p']
  const chargePerSec = costPerSec * PROFIT_MARGIN
  return Math.ceil(durationSeconds * chargePerSec / CREDIT_VALUE)
}

function getCostDetails(resolution: string) {
  const costPerSec = REPLICATE_COST_PER_SECOND[resolution] || REPLICATE_COST_PER_SECOND['720p']
  const chargePerSec = costPerSec * PROFIT_MARGIN
  return { costPerSec, chargePerSec }
}

/**
 * POST /api/generate/lipsync
 * Wan 2.6 I2V — Image + Audio to lip-synced video generation.
 * Up to 10 seconds duration, 480p/720p/1080p resolution.
 * Streams NDJSON progress updates to the client.
 */
export async function POST(req: NextRequest) {
  let userId: string | null = null
  let creditCost = 0
  let creditsDeducted = false

  try {
    userId = await getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      imageUrl,         // required: image/video frame URL
      audioUrl,         // required: audio URL
      duration = 5,     // 2-10 seconds (model max is 10)
      resolution = '720p',
      multiShots = false,
      enablePromptExpansion = false,
      negativePrompt = '',
    } = body

    // Validate required fields
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 })
    }
    if (!audioUrl || typeof audioUrl !== 'string') {
      return NextResponse.json({ error: 'Audio URL is required' }, { status: 400 })
    }

    // Validate duration: API supports up to 10 seconds for lip-sync
    const durationSec = Math.max(2, Math.min(10, Math.round(Number(duration))))

    // Validate resolution (Wan 2.6 I2V only supports 720p and 1080p)
    const validResolutions = ['720p', '1080p']
    const finalResolution = validResolutions.includes(resolution) ? resolution : '720p'

    // Calculate credit cost
    creditCost = calculateCredits(durationSec, finalResolution)

    console.log('🎤 Lip-Sync Generation Request:')
    console.log('  Image URL:', imageUrl.substring(0, 80) + '...')
    console.log('  Audio URL:', audioUrl.substring(0, 80) + '...')
    console.log('  Duration:', durationSec, 'seconds')
    console.log('  Resolution:', finalResolution)
    console.log('  Multi-shots:', multiShots)
    console.log('  Credit Cost:', creditCost)

    // ────── Check & deduct credits ──────
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    )
    const users = await userRes.json()
    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userCredits = users[0].credits || 0
    if (userCredits < creditCost) {
      return NextResponse.json({
        error: `Insufficient credits. ${durationSec}s lip-sync video requires ${creditCost} credits.`,
        creditsNeeded: creditCost,
        creditsAvailable: userCredits,
      }, { status: 402 })
    }

    console.log(`💰 User has ${userCredits} credits. Lip-sync requires ${creditCost} credits.`)

    // Atomically deduct credits
    const deductRes = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_clerk_user_id: userId, p_amount: creditCost }),
    })
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) {
      const raw = await deductRes.json()
      deductResult = Array.isArray(raw) ? raw[0] ?? null : raw
    }
    if (!deductRes.ok || !deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      console.error('❌ Credit deduction blocked:', errorMsg)
      await logCreditTransaction({
        userId, amount: -creditCost, type: 'generation_lipsync', status: 'failed',
        description: `Lip-sync FAILED (${durationSec}s ${finalResolution}) — insufficient credits`,
        metadata: { duration: durationSec },
      })
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
    }

    creditsDeducted = true
    console.log(`✅ ${creditCost} credits deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({
      userId, amount: -creditCost, balanceAfter: deductResult.new_credits,
      type: 'generation_lipsync',
      description: `Lip-sync (${durationSec}s ${finalResolution}) — ${creditCost} credits`,
      metadata: {
        duration: durationSec,
        resolution: finalResolution,
        multiShots,
        costPerSecond: getCostDetails(finalResolution).costPerSec,
        chargePerSecond: getCostDetails(finalResolution).chargePerSec,
        totalCharge: (creditCost * CREDIT_VALUE).toFixed(3),
      },
    })

    // ────── Stream NDJSON progress ──────
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
          } catch { /* stream closed */ }
        }

        try {
          send({ status: 'starting', message: 'Creating lip-sync prediction...' })

          // Build Replicate input for Wan 2.6 I2V
          const replicateInput: Record<string, unknown> = {
            image: imageUrl,
            audio: audioUrl,
            duration: durationSec,
            resolution: finalResolution,
            prompt: 'the person is lipsyncing to the audio',
            multi_shots: multiShots,
            enable_prompt_expansion: enablePromptExpansion,
            negative_prompt: negativePrompt,
          }

          // Create prediction
          const prediction = await replicate.predictions.create({
            model: 'wan-video/wan-2.6-i2v',
            input: replicateInput,
          })
          console.log('🎤 Prediction created:', prediction.id)
          send({ status: 'processing', message: 'Lip-sync video generation in progress...', predictionId: prediction.id })

          // Poll until completed (typically 40-60 seconds for 5-10s video)
          let finalPrediction = prediction
          let pollCount = 0
          const maxPolls = 90 // 90 * 3s = 4.5 minutes max (under 5min Vercel timeout)
          while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && finalPrediction.status !== 'canceled') {
            await new Promise(resolve => setTimeout(resolve, 3000))
            finalPrediction = await replicate.predictions.get(prediction.id)
            pollCount++

            // Send progress every 3rd poll
            if (pollCount % 3 === 0) {
              send({
                status: 'processing',
                message: `Generating lip-sync video... (${pollCount * 3}s elapsed)`,
                predictionStatus: finalPrediction.status,
              })
            }

            if (pollCount >= maxPolls) {
              throw new Error('Lip-sync generation timed out after 4.5 minutes')
            }
          }

          if (finalPrediction.status === 'failed' || finalPrediction.status === 'canceled') {
            console.error('[lipsync] Prediction failed:', finalPrediction.error)
            const errDetail = String(finalPrediction.error || 'Lip-sync generation failed')
            throw new Error(errDetail)
          }

          // ────── Get output URL ──────
          const output = finalPrediction.output
          const videoUrl = typeof output === 'string' ? output : (Array.isArray(output) ? output[0] : output?.url?.())
          if (!videoUrl) {
            throw new Error('No video URL in prediction output')
          }

          send({ status: 'uploading', message: 'Saving lip-sync video to permanent storage...' })

          // ────── Download and upload to R2 ──────
          console.log('⬇️ Downloading video from Replicate...')
          const videoResponse = await fetch(typeof videoUrl === 'string' ? videoUrl : String(videoUrl))
          if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.status}`)
          }

          const videoBlob = await videoResponse.blob()
          const videoBuffer = Buffer.from(await videoBlob.arrayBuffer())
          const videoKey = `videos/lipsync-${userId}-${Date.now()}.mp4`

          console.log(`⬆️ Uploading to R2: ${videoKey} (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`)
          const uploadResult = await uploadToR2(videoBuffer, 'videos', videoKey, 'video/mp4')

          if (!uploadResult.success) {
            throw new Error('Failed to store video permanently')
          }

          const permanentVideoUrl = uploadResult.url!
          console.log('✅ Video stored:', permanentVideoUrl)

          // ────── Save to combined_media ──────
          const title = `Lip-sync: ${durationSec}s ${finalResolution} video`
          const metadataJson = {
            source: 'wan-2.6-i2v',
            duration: durationSec,
            resolution: finalResolution,
            multi_shots: multiShots,
            credit_cost: creditCost,
            cost_per_second: getCostDetails(finalResolution).costPerSec,
            charge_per_second: getCostDetails(finalResolution).chargePerSec,
            type: 'lipsync',
          }

          // Try full insert first (with video_url column), fall back without it
          let savedMedia = null
          const baseFields = {
            user_id: userId,
            type: 'video',
            title,
            audio_url: permanentVideoUrl,  // NOT NULL constraint — use video URL
            image_url: permanentVideoUrl,  // NOT NULL constraint — use video URL
            media_url: permanentVideoUrl,
            prompt: 'Lip-sync video generation',
            genre: 'lipsync',
            is_public: false,
            metadata: metadataJson,
          }

          // Attempt 1: with video_url column
          let insertRes = await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation',
            },
            body: JSON.stringify({ ...baseFields, video_url: permanentVideoUrl }),
          })

          // Attempt 2: without video_url if column doesn't exist yet
          if (!insertRes.ok) {
            console.log('⚠️ Insert with video_url failed, retrying without it...')
            insertRes = await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
              method: 'POST',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
              },
              body: JSON.stringify(baseFields),
            })
          }

          if (insertRes.ok) {
            const inserted = await insertRes.json()
            savedMedia = Array.isArray(inserted) ? inserted[0] : inserted
            console.log('✅ Saved to combined_media:', savedMedia?.id)
          } else {
            const errText = await insertRes.text()
            console.error('⚠️ Failed to save to combined_media:', insertRes.status, errText)
          }

          // Enrich the credit transaction with the output media URL
          updateTransactionMedia({
            userId: userId!,
            type: 'generation_lipsync',
            mediaUrl: permanentVideoUrl,
            mediaType: 'video',
            title,
            extraMeta: { duration: durationSec, resolution: finalResolution },
          }).catch(() => {})

          send({
            status: 'complete',
            message: 'Lip-sync video generated successfully!',
            videoUrl: permanentVideoUrl,
            mediaId: savedMedia?.id || null,
            duration: durationSec,
            creditCost,
          })

          controller.close()

        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'Lip-sync generation failed'
          console.error('❌ Lip-sync generation error:', errMsg)

          // Refund credits on failure
          if (creditsDeducted && userId && creditCost > 0) {
            const refundResult = await refundCredits({
              userId,
              amount: creditCost,
              type: 'generation_lipsync',
              reason: `Lip-sync generation failed: ${errMsg.substring(0, 100)}`,
              metadata: { duration: durationSec },
            })
            if (refundResult.success) {
              console.log(`✅ Refunded ${creditCost} credits for failed lip-sync generation`)
            }
          }

          send({ status: 'error', message: '444 radio is locking in, please try again in a few minutes', error: errMsg })
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (outerError) {
    const errMsg = outerError instanceof Error ? outerError.message : 'Server error'
    console.error('❌ Lip-sync outer error:', errMsg)

    // Refund credits if deducted
    if (creditsDeducted && userId && creditCost > 0) {
      await refundCredits({
        userId,
        amount: creditCost,
        type: 'generation_lipsync',
        reason: `Lip-sync outer error: ${errMsg.substring(0, 100)}`,
      })
    }

    return NextResponse.json({ error: '444 radio is locking in, please try again in a few minutes' }, { status: 500 })
  }
}
