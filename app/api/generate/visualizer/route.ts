import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/hybrid-auth'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { notifyGenerationComplete, notifyCreditDeduct } from '@/lib/notifications'

// Allow up to 5 minutes for video generation (Vercel Pro limit: 300s)
export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Credit cost for 444 Engine video generation.
 * 1 credit = $0.035 | 50% profit margin (charge = cost × 1.5)
 *
 * Replicate per-second cost by variant:
 *   Resolution │ With Audio │ No Audio
 *   ───────────┼────────────┼──────────
 *     480p     │  $0.025/s  │ $0.013/s
 *     720p     │  $0.052/s  │ $0.026/s
 *    1080p     │  $0.120/s  │ $0.060/s
 *
 * Charge (cost × 1.5), then credits = ceil(dur × charge / 0.035):
 *   Variant        │  2s │  5s │  8s │ 12s
 *   ───────────────┼─────┼─────┼─────┼─────
 *   480p  + audio  │   3 │   6 │   9 │  13
 *   480p  silent   │   2 │   3 │   5 │   7
 *   720p  + audio  │   5 │  12 │  18 │  27
 *   720p  silent   │   3 │   6 │   9 │  14
 *   1080p + audio  │  11 │  26 │  42 │  62
 *   1080p silent   │   6 │  13 │  21 │  31
 */
const REPLICATE_COST_PER_SECOND: Record<string, { audio: number; silent: number }> = {
  '480p':  { audio: 0.025, silent: 0.013 },
  '720p':  { audio: 0.052, silent: 0.026 },
  '1080p': { audio: 0.120, silent: 0.060 },
}
const PROFIT_MARGIN = 1.5
const CREDIT_VALUE = 0.035

function calculateCredits(durationSeconds: number, resolution: string, withAudio: boolean): number {
  const tier = REPLICATE_COST_PER_SECOND[resolution] || REPLICATE_COST_PER_SECOND['720p']
  const costPerSec = withAudio ? tier.audio : tier.silent
  const chargePerSec = costPerSec * PROFIT_MARGIN
  return Math.ceil(durationSeconds * chargePerSec / CREDIT_VALUE)
}

function getCostDetails(resolution: string, withAudio: boolean) {
  const tier = REPLICATE_COST_PER_SECOND[resolution] || REPLICATE_COST_PER_SECOND['720p']
  const costPerSec = withAudio ? tier.audio : tier.silent
  const chargePerSec = costPerSec * PROFIT_MARGIN
  return { costPerSec, chargePerSec }
}

/**
 * POST /api/generate/visualizer
 * 444 Engine — text-to-video and image-to-video generation.
 * 1080p, 24fps, 1-12s duration, optional audio, camera control.
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
      prompt,
      imageUrl,         // optional: for image-to-video mode
      duration = 5,     // 2-12 seconds
      resolution = '720p',
      aspectRatio = '16:9',
      cameraFixed = false,
      generateAudio = true,
      seed,
    } = body

    // Validate prompt
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return NextResponse.json({ error: 'Prompt is required (min 3 characters)' }, { status: 400 })
    }
    if (prompt.length > 1000) {
      return NextResponse.json({ error: 'Prompt too long (max 1000 characters)' }, { status: 400 })
    }

    // Validate duration: API supports 2-12
    const durationSec = Math.max(2, Math.min(12, Math.round(Number(duration))))

    // Validate resolution
    const validResolutions = ['480p', '720p', '1080p']
    const finalResolution = validResolutions.includes(resolution) ? resolution : '720p'

    // Validate aspect ratio
    const validAspectRatios = ['16:9', '9:16', '1:1', '4:3', '3:4']
    const finalAspectRatio = validAspectRatios.includes(aspectRatio) ? aspectRatio : '16:9'

    // Calculate credit cost (variant-specific: resolution × audio)
    creditCost = calculateCredits(durationSec, finalResolution, generateAudio)

    console.log('🎬 Visualizer Generation Request:')
    console.log('  Prompt:', prompt.substring(0, 100))
    console.log('  Image URL:', imageUrl ? 'provided' : 'none (text-to-video)')
    console.log('  Duration:', durationSec, 'seconds')
    console.log('  Resolution:', finalResolution)
    console.log('  Aspect Ratio:', finalAspectRatio)
    console.log('  Camera Fixed:', cameraFixed)
    console.log('  Generate Audio:', generateAudio)
    console.log('  Credit Cost:', creditCost)

    // ────── Check & deduct credits ──────
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,free_credits`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    )
    const users = await userRes.json()
    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userCredits = (users[0].credits || 0) + (users[0].free_credits || 0)
    if (userCredits < creditCost) {
      return NextResponse.json({
        error: `Insufficient credits. ${durationSec}s video requires ${creditCost} credits.`,
        creditsNeeded: creditCost,
        creditsAvailable: userCredits,
      }, { status: 402 })
    }

    console.log(`💰 User has ${userCredits} credits (${users[0].free_credits || 0} free). Video requires ${creditCost} credits.`)

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
        userId, amount: -creditCost, type: 'generation_video', status: 'failed',
        description: `444 Visualizer FAILED (${durationSec}s ${finalResolution}) — insufficient credits`,
        metadata: { prompt: prompt.substring(0, 200), duration: durationSec },
      })
      return NextResponse.json({ error: errorMsg }, { status: 402 })
    }

    creditsDeducted = true
    console.log(`✅ ${creditCost} credits deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({
      userId, amount: -creditCost, balanceAfter: deductResult.new_credits,
      type: 'generation_video',
      description: `444 Visualizer (${durationSec}s ${finalResolution}${generateAudio ? ' +audio' : ' silent'}) — ${creditCost} credits`,
      metadata: {
        prompt: prompt.substring(0, 200),
        duration: durationSec,
        resolution: finalResolution,
        aspectRatio: finalAspectRatio,
        cameraFixed,
        generateAudio,
        mode: imageUrl ? 'image-to-video' : 'text-to-video',
        costPerSecond: getCostDetails(finalResolution, generateAudio).costPerSec,
        chargePerSecond: getCostDetails(finalResolution, generateAudio).chargePerSec,
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
          send({ status: 'starting', message: 'Creating video prediction...' })

          // Build Replicate input
          const replicateInput: Record<string, unknown> = {
            prompt: prompt.trim(),
            duration: durationSec,
            resolution: finalResolution,
            aspect_ratio: finalAspectRatio,
            fps: 24,
            camera_fixed: cameraFixed,
            generate_audio: generateAudio,
          }
          if (imageUrl) replicateInput.image = imageUrl
          if (seed !== undefined && seed !== null) replicateInput.seed = Number(seed)

          // Create prediction
          const prediction = await replicate.predictions.create({
            model: 'bytedance/seedance-1.5-pro',
            input: replicateInput,
          })
          console.log('🎬 Prediction created:', prediction.id)
          send({ status: 'processing', message: 'Video generation in progress...', predictionId: prediction.id })

          // Poll until completed (video can take 1-4 minutes)
          let finalPrediction = prediction
          let pollCount = 0
          const maxPolls = 120 // 120 * 3s = 6 minutes max
          while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && finalPrediction.status !== 'canceled') {
            await new Promise(resolve => setTimeout(resolve, 3000))
            finalPrediction = await replicate.predictions.get(prediction.id)
            pollCount++

            // Send progress every 3rd poll
            if (pollCount % 3 === 0) {
              send({
                status: 'processing',
                message: `Generating video... (${pollCount * 3}s elapsed)`,
                predictionStatus: finalPrediction.status,
              })
            }

            if (pollCount >= maxPolls) {
              throw new Error('Video generation timed out after 6 minutes')
            }
          }

          if (finalPrediction.status === 'failed' || finalPrediction.status === 'canceled') {
            console.error('[visualizer] Prediction failed:', finalPrediction.error)
            const errDetail = String(finalPrediction.error || 'Video generation failed')
            throw new Error(errDetail)
          }

          // ────── Get output URL ──────
          const output = finalPrediction.output
          const videoUrl = typeof output === 'string' ? output : (Array.isArray(output) ? output[0] : output?.url?.())
          if (!videoUrl) {
            throw new Error('No video URL in prediction output')
          }

          send({ status: 'uploading', message: 'Saving video to permanent storage...' })

          // ────── Download and upload to R2 ──────
          console.log('⬇️ Downloading video from Replicate...')
          const videoResponse = await fetch(typeof videoUrl === 'string' ? videoUrl : String(videoUrl))
          if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.status}`)
          }

          const videoBlob = await videoResponse.blob()
          const videoBuffer = Buffer.from(await videoBlob.arrayBuffer())
          const videoKey = `videos/visualizer-${userId}-${Date.now()}.mp4`

          console.log(`⬆️ Uploading to R2: ${videoKey} (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`)
          const uploadResult = await uploadToR2(videoBuffer, 'videos', videoKey, 'video/mp4')

          if (!uploadResult.success) {
            throw new Error('Failed to store video permanently')
          }

          const permanentVideoUrl = uploadResult.url!
          console.log('✅ Video stored:', permanentVideoUrl)

          // ────── Save to combined_media ──────
          const title = `Visualizer: ${prompt.substring(0, 60).trim()}`
          const metadataJson = {
            source: '444-engine',
            duration: durationSec,
            resolution: finalResolution,
            aspect_ratio: finalAspectRatio,
            camera_fixed: cameraFixed,
            generate_audio: generateAudio,
            mode: imageUrl ? 'image-to-video' : 'text-to-video',
            credit_cost: creditCost,
            cost_per_second: getCostDetails(finalResolution, generateAudio).costPerSec,
            charge_per_second: getCostDetails(finalResolution, generateAudio).chargePerSec,
          }

          // Try full insert first (with video_url column), fall back without it
          let savedMedia = null
          const baseFields = {
            user_id: userId,
            type: 'video',
            title,
            audio_url: permanentVideoUrl,  // NOT NULL constraint — use video URL
            image_url: permanentVideoUrl,  // NOT NULL constraint — use video URL as placeholder
            media_url: permanentVideoUrl,
            prompt,
            genre: 'visualizer',
            is_public: false,
            metadata: metadataJson,
          }

          // Attempt 1: with video_url column (exists after migration 131)
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
            type: 'generation_video',
            mediaUrl: permanentVideoUrl,
            mediaType: 'video',
            title,
            extraMeta: { duration: durationSec, resolution: finalResolution },
          }).catch(() => {})

          notifyGenerationComplete(userId!, savedMedia?.id || '', 'video', title).catch(() => {})
          notifyCreditDeduct(userId!, creditCost, 'Visualizer Video').catch(() => {})

          send({
            status: 'complete',
            message: 'Video generated successfully!',
            videoUrl: permanentVideoUrl,
            mediaId: savedMedia?.id || null,
            duration: durationSec,
            creditCost,
          })

          controller.close()

        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'Video generation failed'
          console.error('❌ Visualizer generation error:', errMsg)

          // Refund credits on failure
          if (creditsDeducted && userId && creditCost > 0) {
            const refundResult = await refundCredits({
              userId,
              amount: creditCost,
              type: 'generation_video',
              reason: `Visualizer generation failed: ${errMsg.substring(0, 100)}`,
              metadata: { prompt: prompt?.substring(0, 80), duration: durationSec },
            })
            if (refundResult.success) {
              console.log(`✅ Refunded ${creditCost} credits for failed visualizer generation`)
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
    console.error('❌ Visualizer outer error:', errMsg)

    // Refund credits if deducted
    if (creditsDeducted && userId && creditCost > 0) {
      await refundCredits({
        userId,
        amount: creditCost,
        type: 'generation_video',
        reason: `Visualizer outer error: ${errMsg.substring(0, 100)}`,
      })
    }

    return NextResponse.json({ error: '444 radio is locking in, please try again in a few minutes' }, { status: 500 })
  }
}
