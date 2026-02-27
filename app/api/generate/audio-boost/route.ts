import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { uploadToR2 } from '@/lib/r2-upload'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { logBoostGeneration, updateBoostLog } from '@/lib/boost-logs'
import { sanitizeError, sanitizeCreditError, SAFE_ERROR_MESSAGE } from '@/lib/sanitize-error'
import { refundCredits } from '@/lib/refund-credits'

// Allow up to 2 minutes for audio boost processing
export const maxDuration = 120

export async function OPTIONS() {
  return handleOptions()
}

// POST /api/generate/audio-boost - Mix & master audio track
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const {
      audioUrl,
      trackTitle,
      bass_boost = 0,
      treble_boost = 0,
      volume_boost = 2,
      normalize = true,
      noise_reduction = false,
      output_format = 'mp3',
      bitrate = '192k',
    } = body

    if (!audioUrl) {
      return corsResponse(NextResponse.json({ error: 'Missing audio URL' }, { status: 400 }))
    }

    // Validate parameters
    if (bass_boost < -20 || bass_boost > 20) {
      return corsResponse(NextResponse.json({ error: 'Bass boost must be between -20 and 20 dB' }, { status: 400 }))
    }
    if (treble_boost < -20 || treble_boost > 20) {
      return corsResponse(NextResponse.json({ error: 'Treble boost must be between -20 and 20 dB' }, { status: 400 }))
    }
    if (volume_boost < 0 || volume_boost > 10) {
      return corsResponse(NextResponse.json({ error: 'Volume boost must be between 0 and 10' }, { status: 400 }))
    }
    if (!['mp3', 'wav', 'aac', 'ogg'].includes(output_format)) {
      return corsResponse(NextResponse.json({ error: 'Invalid output format' }, { status: 400 }))
    }
    if (!['128k', '192k', '256k', '320k'].includes(bitrate)) {
      return corsResponse(NextResponse.json({ error: 'Invalid bitrate' }, { status: 400 }))
    }

    console.log('🔊 Audio Boost request')
    console.log('🎵 Audio URL:', audioUrl)
    console.log('🎛️ Parameters:', { bass_boost, treble_boost, volume_boost, normalize, noise_reduction, output_format, bitrate })

    // Check user credits (audio boost costs 1 credit)
    const BOOST_COST = 1
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const userData = await userRes.json()
    const user = userData?.[0]

    if (!user || user.credits < BOOST_COST) {
      return corsResponse(NextResponse.json({
        error: `Insufficient credits. Audio Boost requires ${BOOST_COST} credit.`,
        creditsNeeded: BOOST_COST,
        creditsAvailable: user?.credits || 0
      }, { status: 402 }))
    }

    console.log(`💰 User has ${user.credits} credits. Audio Boost requires ${BOOST_COST} credit.`)

    // ✅ DEDUCT credit atomically BEFORE generation (blocks if wallet < $1)
    const deductRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/deduct_credits`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_clerk_user_id: userId, p_amount: BOOST_COST })
      }
    )
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) {
      const raw = await deductRes.json()
      deductResult = Array.isArray(raw) ? raw[0] ?? null : raw
    }
    if (!deductRes.ok || !deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      console.error('❌ Credit deduction blocked:', errorMsg)
      await logCreditTransaction({ userId, amount: -BOOST_COST, type: 'generation_audio_boost', status: 'failed', description: `Audio Boost`, metadata: { bass_boost, treble_boost, volume_boost } })
      return corsResponse(NextResponse.json({ error: sanitizeCreditError(errorMsg) }, { status: 402 }))
    }
    console.log(`✅ Credit deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId, amount: -BOOST_COST, balanceAfter: deductResult.new_credits, type: 'generation_audio_boost', description: `Audio Boost`, metadata: { bass_boost, treble_boost, volume_boost, bitrate, output_format } })

    // Generate boosted audio using lucataco/audio-boost via raw HTTP API
    console.log('🔊 Processing audio with Audio Boost...')

    // Log initial pending state
    const boostLogId = await logBoostGeneration({
      userId,
      status: 'pending',
      sourceAudioUrl: audioUrl,
      trackTitle,
      bassBoost: bass_boost,
      trebleBoost: treble_boost,
      volumeBoost: volume_boost,
      normalize,
      noiseReduction: noise_reduction,
      outputFormat: output_format,
      bitrate,
    })

    try {
      const REPLICATE_TOKEN = process.env.REPLICATE_API_KEY_LATEST2!
      const boostInput = {
        audio: audioUrl,
        bass_boost,
        treble_boost,
        volume_boost,
        normalize,
        noise_reduction,
        output_format,
        bitrate,
      }

      console.log('🔊 Creating prediction via Replicate HTTP API...')
      console.log('🎛️ Input:', JSON.stringify(boostInput))

      // Step 1: Create prediction
      const createRes = await fetch('https://api.replicate.com/v1/models/lucataco/audio-boost/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REPLICATE_TOKEN}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait',  // Wait for completion (up to 60s)
        },
        body: JSON.stringify({ input: boostInput }),
      })

      let prediction = await createRes.json()
      console.log('🔊 Prediction response status:', prediction.status, '| id:', prediction.id)

      // Update log with prediction ID
      if (boostLogId && prediction.id) {
        await updateBoostLog(boostLogId, { predictionId: prediction.id, status: 'processing' })
      }

      if (prediction.error) {
        console.error('[audio-boost] Prediction error:', prediction.error)
        throw new Error(SAFE_ERROR_MESSAGE)
      }

      // Step 2: Poll if not yet completed (Prefer: wait may timeout)
      let pollAttempts = 0
      const maxPollAttempts = 60

      while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled' && pollAttempts < maxPollAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` },
        })
        prediction = await pollRes.json()
        console.log(`🔊 Poll ${pollAttempts}: status=${prediction.status}`)
        pollAttempts++
      }

      if (prediction.status === 'failed' || prediction.status === 'canceled') {
        const errMsg = typeof prediction.error === 'string' ? prediction.error : JSON.stringify(prediction.error) || 'Audio boost failed'
        console.error('[audio-boost] Prediction failed:', errMsg)
        if (boostLogId) {
          await updateBoostLog(boostLogId, { status: prediction.status as 'failed' | 'canceled', errorMessage: errMsg })
        }
        throw new Error(SAFE_ERROR_MESSAGE)
      }

      if (prediction.status !== 'succeeded') {
        const errMsg = `Audio boost timed out after ${pollAttempts}s (status: ${prediction.status})`
        console.error('[audio-boost]', errMsg)
        if (boostLogId) {
          await updateBoostLog(boostLogId, { status: 'failed', errorMessage: errMsg })
        }
        throw new Error(SAFE_ERROR_MESSAGE)
      }

      // Step 3: Extract output URL
      const replicateOutputUrl = typeof prediction.output === 'string'
        ? prediction.output
        : prediction.output?.url || prediction.output?.[0]

      console.log('🔊 Raw output:', JSON.stringify(prediction.output))
      console.log('🔊 Extracted URL:', replicateOutputUrl)

      if (!replicateOutputUrl || typeof replicateOutputUrl !== 'string') {
        const errMsg = `No output URL from Audio Boost. Raw output: ${JSON.stringify(prediction.output)}`
        console.error('[audio-boost]', errMsg)
        if (boostLogId) {
          await updateBoostLog(boostLogId, { status: 'failed', errorMessage: errMsg })
        }
        throw new Error(SAFE_ERROR_MESSAGE)
      }

      console.log('✅ Audio Boost output:', replicateOutputUrl)

      // Download and re-upload to R2 for permanent storage
      console.log('📥 Downloading boosted audio...')
      const downloadRes = await fetch(replicateOutputUrl)
      if (!downloadRes.ok) {
        throw new Error('Failed to download boosted audio')
      }

      const outputBuffer = Buffer.from(await downloadRes.arrayBuffer())
      const outputFileName = `${userId}/boosted-${Date.now()}.${output_format}`

      const outputR2Result = await uploadToR2(
        outputBuffer,
        'audio-files',
        outputFileName
      )

      if (!outputR2Result.success) {
        throw new Error('Failed to upload boosted audio to R2')
      }

      console.log('✅ Boosted audio uploaded to R2:', outputR2Result.url)

      // Save to combined_media table
      console.log('💾 Saving to combined_media...')
      let libraryId = null
      let librarySaveError = null

      try {
        const savePayload = {
          user_id: userId,
          type: 'audio',
          title: trackTitle ? `${trackTitle} (Boosted)` : 'Boosted Audio',
          audio_prompt: `Audio Boost: bass=${bass_boost}dB, treble=${treble_boost}dB, vol=${volume_boost}x`,
          prompt: `Audio Boost: bass=${bass_boost}dB, treble=${treble_boost}dB, vol=${volume_boost}x`,
          audio_url: outputR2Result.url,
          image_url: null,
          is_public: false,
          genre: 'boosted'
        }

        const saveRes = await fetch(
          `${supabaseUrl}/rest/v1/combined_media`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(savePayload)
          }
        )

        if (!saveRes.ok) {
          const errorText = await saveRes.text()
          librarySaveError = `HTTP ${saveRes.status}: ${errorText}`
          console.error('❌ Library save failed:', librarySaveError)
        } else {
          const saved = await saveRes.json()
          libraryId = saved[0]?.id || saved?.id
          console.log('✅ Saved to library:', libraryId)
        }
      } catch (saveError) {
        librarySaveError = saveError instanceof Error ? saveError.message : 'Unknown save error'
        console.error('❌ Library save exception:', librarySaveError)
      }

      // Final boost log update — succeeded with all details
      if (boostLogId) {
        await updateBoostLog(boostLogId, {
          status: 'succeeded',
          replicateOutputUrl,
          outputAudioUrl: outputR2Result.url,
          libraryId: libraryId ?? undefined,
          creditsCharged: BOOST_COST,
          creditsRemaining: deductResult!.new_credits,
          replicatePredictTime: prediction.metrics?.predict_time ?? undefined,
          replicateTotalTime: prediction.metrics?.total_time ?? undefined,
        })
      }

      console.log('✅ Audio Boost complete')

      // Update transaction with output media
      updateTransactionMedia({ userId, type: 'generation_audio_boost', mediaUrl: outputR2Result.url, mediaType: 'audio', title: 'Audio Boost' }).catch(() => {})

      // Quest progress: fire-and-forget
      const { trackQuestProgress, trackGenerationStreak } = await import('@/lib/quest-progress')
      trackQuestProgress(userId, 'use_mastering').catch(() => {})
      trackGenerationStreak(userId).catch(() => {})

      return corsResponse(NextResponse.json({
        success: true,
        audioUrl: outputR2Result.url,
        settings: { bass_boost, treble_boost, volume_boost, normalize, noise_reduction, output_format, bitrate },
        creditsRemaining: deductResult!.new_credits,
        creditsUsed: BOOST_COST,
        libraryId,
        librarySaveError,
        message: libraryId
          ? 'Audio boosted and saved successfully'
          : 'Audio boosted but not saved to library'
      }))

    } catch (genError) {
      console.error('❌ Audio Boost generation failed:', genError)
      const errStr = String(genError).substring(0, 500)
      if (boostLogId) {
        await updateBoostLog(boostLogId, { status: 'failed', errorMessage: errStr })
      }
      await refundCredits({ userId, amount: BOOST_COST, type: 'generation_audio_boost', reason: 'Audio Boost failed', metadata: { error: errStr } })
      throw genError
    }

  } catch (error) {
    console.error('Audio Boost error:', error)
    return corsResponse(NextResponse.json(
      { error: SAFE_ERROR_MESSAGE },
      { status: 500 }
    ))
  }
}
