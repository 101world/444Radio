import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { sanitizeCreditError, SAFE_ERROR_MESSAGE } from '@/lib/sanitize-error'

// Allow up to 5 minutes for video-to-audio generation (Vercel Pro limit: 300s)
export const maxDuration = 300

// Both use REPLICATE_API_KEY_LATEST2
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

// POST /api/generate/video-to-audio - Generate synced audio/SFX for video
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { videoUrl, prompt, quality = 'standard' } = body

    if (!videoUrl || !prompt) {
      return NextResponse.json({ error: 'Missing videoUrl or prompt' }, { status: 400 })
    }

    // Validate quality parameter
    if (!['standard', 'hq'].includes(quality)) {
      return NextResponse.json({ error: 'Invalid quality. Must be "standard" or "hq"' }, { status: 400 })
    }

    const isHQ = quality === 'hq'
    const creditsRequired = isHQ ? 10 : 2

    // Validate videoUrl is a proper URI
    let validatedUrl: string
    try {
      const urlObj = new URL(videoUrl)
      validatedUrl = urlObj.href
      
      // Ensure it's http or https
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('URL must use HTTP or HTTPS protocol')
      }
      
      console.log('✅ Valid video URL:', validatedUrl)
    } catch (e) {
      console.error('❌ Invalid video URL format:', videoUrl, e)
      return NextResponse.json({ 
        error: 'Invalid video URL format. Must be a valid HTTP(S) URL.'
      }, { status: 400 })
    }

    console.log(`🎬 Video-to-audio generation request (${quality.toUpperCase()})`)
    console.log('📹 Video URL:', videoUrl)
    console.log('💬 Prompt:', prompt)
    console.log(`💰 Credits required: ${creditsRequired}`)

    // Check user credits
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
    
    if (!user || user.credits < creditsRequired) {
      return NextResponse.json({ 
        error: `Insufficient credits. ${isHQ ? 'HQ' : 'Standard'} video-to-audio generation requires ${creditsRequired} credits.`,
        creditsNeeded: creditsRequired,
        creditsAvailable: user?.credits || 0
      }, { status: 402 })
    }

    console.log(`💰 User has ${user.credits} credits. ${isHQ ? 'HQ' : 'Standard'} generation requires ${creditsRequired} credits.`)

    // ✅ DEDUCT credits atomically BEFORE generation (blocks if wallet < $1)
    const deductRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/deduct_credits`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_clerk_user_id: userId, p_amount: creditsRequired })
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
      await logCreditTransaction({ userId, amount: -creditsRequired, type: 'generation_video_to_audio', status: 'failed', description: `Video SFX: ${prompt.substring(0, 50)}`, metadata: { prompt, quality, isHQ } })
      return NextResponse.json({ error: sanitizeCreditError(errorMsg) }, { status: 402 })
    }
    console.log(`✅ Credits deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId, amount: -creditsRequired, balanceAfter: deductResult.new_credits, type: 'generation_video_to_audio', description: `Video SFX: ${prompt.substring(0, 50)}`, metadata: { prompt, quality, isHQ } })

    // Video is already uploaded to R2, use the validated URL directly
    console.log('✅ Using uploaded video URL:', validatedUrl)

    // Generate audio using appropriate model based on quality
    const modelName = isHQ ? 'HunyuanVideo-Foley (HQ)' : 'MMAudio (Standard)'
    console.log(`🎵 Generating synced audio with ${modelName}...`)
    console.log('🎵 Prompt:', prompt)
    console.log('🎵 Video URL:', validatedUrl)

    let output: any
    const maxRetries = 3
    let lastError: any = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🎵 Generation attempt ${attempt}/${maxRetries}`)
        
        let prediction: any
        
        if (isHQ) {
          // HQ: HunyuanVideo-Foley model
          prediction = await replicate.predictions.create({
            model: "tencent/hunyuanvideo-foley",
            version: "88045928bb97971cffefabfc05a4e55e5bb1c96d475ad4ecc3d229d9169758ae",
            input: {
              video: validatedUrl,
              prompt: prompt,
              return_audio: false, // Return video with audio
              guidance_scale: 4.5,
              num_inference_steps: 50
            }
          })
        } else {
          // Standard: MMAudio model
          prediction = await replicate.predictions.create({
            model: "zsxkib/mmaudio",
            version: "62871fb59889b2d7c13777f08deb3b36bdff88f7e1d53a50ad7694548a41b484",
            input: {
              video: validatedUrl,
              prompt: prompt,
              duration: 8,
              num_steps: 25,
              cfg_strength: 4.5,
              negative_prompt: "music",
              seed: -1
            }
          })
        }

        console.log('🎵 Prediction created:', prediction.id)

        // Poll until completed (HQ takes longer)
        let finalPrediction = prediction
        let pollAttempts = 0
        const maxPollAttempts = isHQ ? 120 : 60 // HQ: 2 min, Standard: 1 min
        
        while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && pollAttempts < maxPollAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          finalPrediction = await replicate.predictions.get(prediction.id)
          console.log(`🎵 Status: ${finalPrediction.status}`)
          pollAttempts++
        }

        if (finalPrediction.status === 'failed') {
          console.error('[video-to-audio] Prediction failed:', finalPrediction.error)
          throw new Error('Generation failed')
        }

        if (finalPrediction.status !== 'succeeded') {
          throw new Error('Generation timed out')
        }

        output = finalPrediction.output
        console.log(`✅ ${modelName} generation succeeded`)
        break // Success, exit retry loop

      } catch (genError) {
        lastError = genError
        const errorMessage = genError instanceof Error ? genError.message : String(genError)
        const is502Error = errorMessage.includes('502') || errorMessage.includes('Bad Gateway')
        
        if (is502Error && attempt < maxRetries) {
          const waitTime = attempt * 3
          console.log(`⚠️ 502 Bad Gateway (attempt ${attempt}/${maxRetries}), retrying in ${waitTime}s...`)
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000))
          continue
        }
        
        console.error(`❌ Generation failed after ${attempt} attempts:`, genError)
        await logCreditTransaction({ userId, amount: 0, type: 'generation_video_to_audio', status: 'failed', description: `Video SFX failed: ${prompt?.substring(0, 50) || 'unknown'}`, metadata: { prompt, retriesAttempted: attempt, error: errorMessage.substring(0, 200) } })
        
        return NextResponse.json(
          { 
            error: SAFE_ERROR_MESSAGE,
            creditsRefunded: false,
            creditsRemaining: user.credits,
            retriesAttempted: attempt
          },
          { status: 500 }
        )
      }
    }

    if (!output) {
      const errorMessage = lastError instanceof Error ? lastError.message : String(lastError)
      const is502Error = errorMessage.includes('502') || errorMessage.includes('Bad Gateway')
      
      return NextResponse.json(
        { 
          error: SAFE_ERROR_MESSAGE,
          creditsRefunded: false,
          creditsRemaining: user.credits,
          retriesAttempted: maxRetries
        },
        { status: 500 }
      )
    }

    // Output is a video URL with synced audio
    const outputVideoUrl = typeof output === 'string' ? output : output.url || output[0]
    
    if (!outputVideoUrl) {
      throw new Error('No output URL from MMAudio')
    }

    console.log('✅ Output video with audio:', outputVideoUrl)

    // Download and re-upload to R2 for permanent storage
    console.log('📥 Downloading generated video...')
    const downloadRes = await fetch(outputVideoUrl)
    if (!downloadRes.ok) {
      throw new Error('Failed to download generated video')
    }

    const outputBuffer = Buffer.from(await downloadRes.arrayBuffer())
    const outputFileName = `${userId}/synced-${Date.now()}.mp4`
    
    const outputR2Result = await uploadToR2(
      outputBuffer,
      '444radio-media',
      outputFileName
    )

    if (!outputR2Result.success) {
      throw new Error('Failed to upload result to R2')
    }

    console.log('✅ Result uploaded to R2:', outputR2Result.url)

    // Save to combined_media table
    console.log('💾 Saving to combined_media...')
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
        body: JSON.stringify({
          user_id: userId,
          type: 'video',
          title: `${isHQ ? '[HQ] ' : ''}Video SFX: ${prompt.substring(0, 50)}`,
          prompt: prompt,
          audio_url: outputR2Result.url, // Store in audio_url (existing column)
          media_url: outputR2Result.url, // Also store in media_url (new column, if exists)
          is_public: false // Tool output - not a released track
        })
      }
    )

    if (!saveRes.ok) {
      console.error('⚠️ Failed to save to library')
    } else {
      const saved = await saveRes.json()
      console.log('✅ Saved to library:', saved[0]?.id)
    }

    console.log('✅ Video-to-audio generation complete')

    // Update transaction with output media
    updateTransactionMedia({ userId, type: 'generation_video_to_audio', mediaUrl: outputR2Result.url, mediaType: 'audio', title: `Video SFX: ${prompt.substring(0, 40)}` }).catch(() => {})

    // Quest progress: fire-and-forget
    const { trackQuestProgress } = await import('@/lib/quest-progress')
    trackQuestProgress(userId, 'generate_songs').catch(() => {})

    return NextResponse.json({ 
      success: true, 
      videoUrl: outputR2Result.url,
      prompt,
      quality,
      creditsRemaining: deductResult!.new_credits,
      message: `${isHQ ? 'HQ' : 'Standard'} synced audio generated successfully`
    })

  } catch (error) {
    console.error('Video-to-audio generation error:', error)
    return NextResponse.json(
      { error: SAFE_ERROR_MESSAGE },
      { status: 500 }
    )
  }
}
