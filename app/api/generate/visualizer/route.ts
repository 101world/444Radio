import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'

// Allow up to 5 minutes for video generation (Vercel Pro limit: 300s)
export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Calculate credit cost based on video duration in seconds.
 * Pricing: ~$0.075/second selling price → Math.ceil(duration * 0.75) credits
 * 1s=1, 3s=3, 6s=5, 9s=7, 12s=9
 */
function calculateCredits(durationSeconds: number): number {
  return Math.ceil(durationSeconds * 0.75)
}

/**
 * POST /api/generate/visualizer
 * Text-to-video and image-to-video generation using Seedance 1.5 Pro.
 * Streams NDJSON progress updates to the client.
 */
export async function POST(req: NextRequest) {
  let userId: string | null = null
  let creditCost = 0
  let creditsDeducted = false

  try {
    const authResult = await auth()
    userId = authResult.userId
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

    // Calculate credit cost
    creditCost = calculateCredits(durationSec)

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
        error: `Insufficient credits. ${durationSec}s video requires ${creditCost} credits.`,
        creditsNeeded: creditCost,
        creditsAvailable: userCredits,
      }, { status: 402 })
    }

    console.log(`💰 User has ${userCredits} credits. Video requires ${creditCost} credits.`)

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
        description: `Visualizer (${durationSec}s): ${prompt.substring(0, 80)}`,
        metadata: { prompt, duration: durationSec },
      })
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
    }

    creditsDeducted = true
    console.log(`✅ ${creditCost} credits deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({
      userId, amount: -creditCost, balanceAfter: deductResult.new_credits,
      type: 'generation_video',
      description: `Visualizer (${durationSec}s): ${prompt.substring(0, 80)}`,
      metadata: { prompt, duration: durationSec, resolution: finalResolution, aspectRatio: finalAspectRatio, mode: imageUrl ? 'image-to-video' : 'text-to-video' },
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
          const insertRes = await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation',
            },
            body: JSON.stringify({
              user_id: userId,
              type: 'video',
              title,
              media_url: permanentVideoUrl,
              cover_url: null,
              prompt,
              genre: 'visualizer',
              is_public: false,
              is_ai_generated: true,
              metadata: {
                source: 'seedance-1.5-pro',
                duration: durationSec,
                resolution: finalResolution,
                aspect_ratio: finalAspectRatio,
                camera_fixed: cameraFixed,
                generate_audio: generateAudio,
                mode: imageUrl ? 'image-to-video' : 'text-to-video',
                credit_cost: creditCost,
              },
            }),
          })

          let savedMedia = null
          if (insertRes.ok) {
            const inserted = await insertRes.json()
            savedMedia = Array.isArray(inserted) ? inserted[0] : inserted
            console.log('✅ Saved to combined_media:', savedMedia?.id)
          } else {
            console.error('⚠️ Failed to save to combined_media:', insertRes.status, await insertRes.text())
          }

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
