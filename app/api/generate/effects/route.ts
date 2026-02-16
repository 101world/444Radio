import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { sanitizeError, sanitizeCreditError, SAFE_ERROR_MESSAGE } from '@/lib/sanitize-error'

// Allow up to 2.5 minutes for effects generation (AudioGen can take 60-90s)
export const maxDuration = 150

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

export async function OPTIONS() {
  return handleOptions()
}

// POST /api/generate/effects - Generate sound effects from text prompt
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const { 
      prompt, 
      duration = 5,
      top_k = 250,
      top_p = 0,
      temperature = 1,
      classifier_free_guidance = 3,
      output_format = 'mp3'
    } = body

    if (!prompt || !prompt.trim()) {
      return corsResponse(NextResponse.json({ error: 'Missing prompt' }, { status: 400 }))
    }

    // Validate duration (1-10 seconds)
    if (duration < 1 || duration > 10) {
      return corsResponse(NextResponse.json({ error: 'Duration must be between 1 and 10 seconds' }, { status: 400 }))
    }

    console.log('🎨 Effects generation request')
    console.log('💬 Prompt:', prompt)
    console.log('⏱️ Duration:', duration)
    console.log('🎛️ Parameters:', { top_k, top_p, temperature, classifier_free_guidance, output_format })

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
    
    if (!user || user.credits < 2) {
      return corsResponse(NextResponse.json({ 
        error: 'Insufficient credits. Effects generation requires 2 credits.',
        creditsNeeded: 2,
        creditsAvailable: user?.credits || 0
      }, { status: 402 }))
    }

    console.log(`💰 User has ${user.credits} credits. Effects generation requires 2 credits.`)

    // ✅ DEDUCT 2 CREDITS atomically BEFORE generation (blocks if wallet < $1)
    const deductRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/deduct_credits`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_clerk_user_id: userId, p_amount: 2 })
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
      await logCreditTransaction({ userId, amount: -2, type: 'generation_effects', status: 'failed', description: `Effects: ${prompt}`, metadata: { prompt, duration } })
      return corsResponse(NextResponse.json({ error: sanitizeCreditError(errorMsg) }, { status: 402 }))
    }
    console.log(`✅ Credits deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId, amount: -2, balanceAfter: deductResult.new_credits, type: 'generation_effects', description: `Effects: ${prompt}`, metadata: { prompt, duration } })

    // Generate sound effects using AudioGen
    console.log('🎨 Generating sound effects with AudioGen...')
    
    try {
      const prediction = await replicate.predictions.create({
        model: "sepal/audiogen",
        version: "154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8",
        input: {
          prompt: prompt,
          duration: duration,
          top_k: top_k,
          top_p: top_p,
          temperature: temperature,
          classifier_free_guidance: classifier_free_guidance,
          output_format: output_format
        }
      })

      console.log('🎨 Prediction created:', prediction.id)

      // Poll until completed (effects can take 60-90s)
      let finalPrediction = prediction
      let pollAttempts = 0
      const maxPollAttempts = 90 // 90 seconds max for AudioGen
      
      while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && pollAttempts < maxPollAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        finalPrediction = await replicate.predictions.get(prediction.id)
        console.log(`🎨 Status: ${finalPrediction.status} (${pollAttempts}s elapsed)`)
        pollAttempts++
      }

      if (finalPrediction.status === 'failed') {
        console.error('[effects] Prediction failed:', finalPrediction.error)
        throw new Error(SAFE_ERROR_MESSAGE)
      }

      if (finalPrediction.status !== 'succeeded') {
        throw new Error('Generation timed out')
      }

      const output = finalPrediction.output
      const outputAudioUrl = typeof output === 'string' ? output : output?.url || output?.[0]
      
      if (!outputAudioUrl) {
        throw new Error('No output URL from AudioGen')
      }

      console.log('✅ AudioGen output:', outputAudioUrl)

      // Download and re-upload to R2 for permanent storage
      console.log('📥 Downloading generated audio...')
      const downloadRes = await fetch(outputAudioUrl)
      if (!downloadRes.ok) {
        throw new Error('Failed to download generated audio')
      }

      const outputBuffer = Buffer.from(await downloadRes.arrayBuffer())
      const outputFileName = `${userId}/effects-${Date.now()}.${output_format}`
      
      const outputR2Result = await uploadToR2(
        outputBuffer,
        'audio-files',
        outputFileName
      )

      if (!outputR2Result.success) {
        throw new Error('Failed to upload result to R2')
      }

      console.log('✅ Result uploaded to R2:', outputR2Result.url)

      // Save to combined_media table
      console.log('💾 Saving to combined_media...')
      let libraryId = null
      let librarySaveError = null
      
      try {
        const savePayload = {
          user_id: userId,
          type: 'audio',
          title: `SFX: ${prompt.substring(0, 50)}`,
          audio_prompt: prompt,
          prompt: prompt,
          audio_url: outputR2Result.url,
          image_url: null, // Explicitly set to null for audio-only content
          is_public: false,
          genre: 'effects'
        }
        
        console.log('💾 Save payload:', JSON.stringify(savePayload, null, 2))
        
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
          console.error('Response headers:', Object.fromEntries(saveRes.headers.entries()))
        } else {
          const saved = await saveRes.json()
          libraryId = saved[0]?.id || saved?.id
          console.log('✅ Saved to library:', libraryId)
          console.log('✅ Full response:', JSON.stringify(saved, null, 2))
        }
      } catch (saveError) {
        librarySaveError = saveError instanceof Error ? saveError.message : 'Unknown save error'
        console.error('❌ Library save exception:', librarySaveError)
      }

      console.log('✅ Effects generation complete')

      // Quest progress: fire-and-forget
      const { trackQuestProgress } = await import('@/lib/quest-progress')
      trackQuestProgress(userId, 'generate_songs').catch(() => {})

      return corsResponse(NextResponse.json({ 
        success: true, 
        audioUrl: outputR2Result.url,
        prompt,
        duration,
        creditsRemaining: deductResult!.new_credits,
        libraryId, // Include library ID if saved successfully
        librarySaveError, // Include error if save failed
        message: libraryId 
          ? 'Sound effects generated and saved successfully'
          : 'Sound effects generated but not saved to library'
      }))

    } catch (genError) {
      console.error('❌ AudioGen generation failed:', genError)
      await logCreditTransaction({ userId, amount: 0, type: 'generation_effects', status: 'failed', description: `Effects failed: ${prompt?.substring(0, 50) || 'unknown'}`, metadata: { prompt, error: String(genError).substring(0, 200) } })
      throw genError
    }

  } catch (error) {
    console.error('Effects generation error:', error)
    return corsResponse(NextResponse.json(
      { error: SAFE_ERROR_MESSAGE },
      { status: 500 }
    ))
  }
}
