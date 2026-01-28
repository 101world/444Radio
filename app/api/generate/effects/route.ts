import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'
import { corsResponse, handleOptions } from '@/lib/cors'

// Allow up to 2 minutes for effects generation
export const maxDuration = 120

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST!,
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

      // Poll until completed
      let finalPrediction = prediction
      let pollAttempts = 0
      const maxPollAttempts = 60 // 60 seconds max
      
      while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && pollAttempts < maxPollAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        finalPrediction = await replicate.predictions.get(prediction.id)
        console.log(`🎨 Status: ${finalPrediction.status} (${pollAttempts}s elapsed)`)
        pollAttempts++
      }

      if (finalPrediction.status === 'failed') {
        throw new Error(typeof finalPrediction.error === 'string' ? finalPrediction.error : 'Generation failed')
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
            type: 'audio',
            title: `SFX: ${prompt.substring(0, 50)}`,
            audio_prompt: prompt, // Use audio_prompt for library compatibility
            prompt: prompt, // Keep prompt for backward compat
            audio_url: outputR2Result.url,
            is_public: true,
            genre: 'effects' // Tag as effects for filtering
          })
        }
      )

      if (!saveRes.ok) {
        console.error('⚠️ Failed to save to library')
      } else {
        const saved = await saveRes.json()
        console.log('✅ Saved to library:', saved[0]?.id)
      }

      // Deduct credits (-2) since everything succeeded
      console.log(`💰 Deducting 2 credits from user (${user.credits} → ${user.credits - 2})`)
      const creditDeductRes = await fetch(
        `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            credits: user.credits - 2,
            total_generated: (user.total_generated || 0) + 1
          })
        }
      )

      if (!creditDeductRes.ok) {
        console.error('⚠️ Failed to deduct credits, but generation succeeded')
      } else {
        console.log('✅ Credits deducted successfully')
      }

      console.log('✅ Effects generation complete')

      return corsResponse(NextResponse.json({ 
        success: true, 
        audioUrl: outputR2Result.url,
        prompt,
        duration,
        creditsRemaining: user.credits - 2,
        message: 'Sound effects generated successfully'
      }))

    } catch (genError) {
      console.error('❌ AudioGen generation failed:', genError)
      throw genError
    }

  } catch (error) {
    console.error('Effects generation error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return corsResponse(NextResponse.json(
      { error: `Failed to generate effects: ${errorMessage}` },
      { status: 500 }
    ))
  }
}
