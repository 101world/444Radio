import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { createClient } from '@supabase/supabase-js'
import { sanitizeCreditError, SAFE_ERROR_MESSAGE } from '@/lib/sanitize-error'

// Allow up to 3 minutes for extraction
export const maxDuration = 180

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EXTRACT_COST = 1

export async function OPTIONS() {
  return handleOptions()
}

// POST /api/generate/extract-video-audio — Extract audio from video
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const {
      videoUrl,
      trackTitle = 'Extracted Audio',
      fade_in = 0,
      fade_out = 0,
      trim_start = 0,
      trim_end = 0,
      volume_boost = 1,
      audio_quality = 'high',
      output_format = 'mp3',
      noise_reduction = false,
      normalize_audio = false,
    } = body

    if (!videoUrl) {
      return corsResponse(NextResponse.json({ error: 'Video URL is required' }, { status: 400 }))
    }

    console.log('🎬 Extract Audio from Video request')
    console.log('📹 Video URL:', videoUrl)
    console.log('💰 Credit cost:', EXTRACT_COST)

    // Check user credits
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single()

    if (userError || !userData) {
      return corsResponse(NextResponse.json({ error: 'User not found' }, { status: 404 }))
    }

    if (userData.credits < EXTRACT_COST) {
      return corsResponse(NextResponse.json({
        error: `Insufficient credits. Need ${EXTRACT_COST} credit but have ${userData.credits}`,
        creditsNeeded: EXTRACT_COST,
        creditsAvailable: userData.credits
      }, { status: 402 }))
    }

    console.log(`💰 User has ${userData.credits} credits. Extract costs ${EXTRACT_COST} credit.`)

    // ✅ DEDUCT credit atomically BEFORE generation (blocks if wallet < $1)
    const { data: deductResultRaw } = await supabase
      .rpc('deduct_credits', { p_clerk_user_id: userId, p_amount: EXTRACT_COST })
      .single()
    const deductResult = deductResultRaw as { success: boolean; new_credits: number; error_message?: string | null } | null
    if (!deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      console.error('❌ Credit deduction blocked:', errorMsg)
      await logCreditTransaction({ userId, amount: -EXTRACT_COST, type: 'generation_extract', status: 'failed', description: `Video Extract: ${trackTitle}`, metadata: { videoUrl } })
      return corsResponse(NextResponse.json({ error: sanitizeCreditError(errorMsg) }, { status: 402 }))
    }
    console.log(`✅ Credit deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId, amount: -EXTRACT_COST, balanceAfter: deductResult.new_credits, type: 'generation_extract', description: `Video Extract: ${trackTitle}`, metadata: { videoUrl } })

    // Create Replicate prediction using lucataco/extract-audio
    console.log('🔄 Extracting audio from video with lucataco/extract-audio...')

    try {
      const prediction = await replicate.predictions.create({
        model: "lucataco/extract-audio",
        input: {
          video: videoUrl,
          fade_in,
          fade_out,
          trim_end,
          trim_start,
          volume_boost,
          audio_quality,
          output_format,
          noise_reduction,
          normalize_audio,
        }
      })

      console.log('📡 Prediction created:', prediction.id)

      // Poll until completed (usually very fast — under 5s)
      let finalPrediction = prediction
      let attempts = 0
      const maxPollAttempts = 60 // 60 seconds max

      while (
        finalPrediction.status !== 'succeeded' &&
        finalPrediction.status !== 'failed' &&
        finalPrediction.status !== 'canceled' &&
        attempts < maxPollAttempts
      ) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        finalPrediction = await replicate.predictions.get(prediction.id)
        attempts++
      }

      if (finalPrediction.status !== 'succeeded') {
        const errMsg = finalPrediction.error || 'Extraction failed or timed out'
        console.error('❌ Extraction failed:', errMsg)
        await logCreditTransaction({ userId, amount: 0, type: 'generation_extract', status: 'failed', description: `Video Extract failed: ${trackTitle}`, metadata: { videoUrl, error: String(errMsg).substring(0, 200) } })
        return corsResponse(NextResponse.json({ error: SAFE_ERROR_MESSAGE }, { status: 500 }))
      }

      // Output is a direct URL string
      const outputUrl = finalPrediction.output as string
      if (!outputUrl) {
        await logCreditTransaction({ userId, amount: 0, type: 'generation_extract', status: 'failed', description: `Video Extract: no output`, metadata: { videoUrl } })
        return corsResponse(NextResponse.json({ error: 'No audio output from extraction' }, { status: 500 }))
      }

      console.log('✅ Audio extracted:', outputUrl)

      // Download and upload to R2 for permanent storage
      const dlRes = await fetch(outputUrl)
      if (!dlRes.ok) {
        throw new Error(`Failed to download extracted audio: ${dlRes.status}`)
      }
      const buffer = Buffer.from(await dlRes.arrayBuffer())
      const timestamp = Date.now()
      const ext = output_format || 'mp3'
      const r2Key = `${userId}/extract/${timestamp}-video-extract.${ext}`

      const r2Result = await uploadToR2(buffer, 'audio-files', r2Key, `audio/${ext === 'mp3' ? 'mpeg' : ext}`)

      if (!r2Result.success || !r2Result.url) {
        throw new Error('Failed to upload extracted audio to storage')
      }

      console.log('✅ Uploaded to R2:', r2Result.url)

      // Save to combined_media library
      const { data: saved, error: saveErr } = await supabase
        .from('combined_media')
        .insert({
          user_id: userId,
          type: 'audio',
          title: `${trackTitle} (Video Extract)`,
          audio_url: r2Result.url,
          is_public: false,
          genre: 'extract',
          description: `Audio extracted from video`,
          metadata: JSON.stringify({
            source: 'video-to-audio',
            audio_quality,
            output_format,
            noise_reduction,
            normalize_audio,
            fade_in,
            fade_out,
            volume_boost,
          })
        })
        .select('id')
        .single()

      if (saveErr) {
        console.error('❌ Library save error:', saveErr.message)
      } else {
        console.log('✅ Saved to library:', saved?.id)
      }

      // Quest progress: fire-and-forget
      const { trackQuestProgress } = await import('@/lib/quest-progress')
      trackQuestProgress(userId, 'generate_songs').catch(() => {})

      // Update transaction with output media
      updateTransactionMedia({ userId, type: 'generation_extract', mediaUrl: r2Result.url, mediaType: 'audio', title: `${trackTitle} (Video Extract)` }).catch(() => {})

      return corsResponse(NextResponse.json({
        success: true,
        audioUrl: r2Result.url,
        libraryId: saved?.id,
        title: `${trackTitle} (Video Extract)`,
        creditsUsed: EXTRACT_COST,
        creditsRemaining: deductResult.new_credits,
        extractType: 'video-to-audio',
      }))

    } catch (genError) {
      console.error('❌ Video audio extraction failed:', genError)
      await logCreditTransaction({ userId, amount: 0, type: 'generation_extract', status: 'failed', description: `Video Extract failed: ${trackTitle}`, metadata: { videoUrl, error: String(genError).substring(0, 200) } })
      throw genError
    }

  } catch (error) {
    console.error('Extract video audio error:', error)
    return corsResponse(NextResponse.json(
      { error: SAFE_ERROR_MESSAGE },
      { status: 500 }
    ))
  }
}
