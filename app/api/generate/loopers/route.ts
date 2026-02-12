import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'
import { corsResponse, handleOptions } from '@/lib/cors'

// Allow up to 3 minutes for looper generation (can take 1-2 minutes for 20s loops)
export const maxDuration = 180

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

export async function OPTIONS() {
  return handleOptions()
}

// POST /api/generate/loopers - Generate fixed BPM loops
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const { 
      prompt, 
      bpm = 120,
      max_duration = 8,
      variations = 2,
      model_version = 'large',
      output_format = 'wav',
      classifier_free_guidance = 3,
      temperature = 1,
      top_k = 250,
      top_p = 0,
      seed = -1
    } = body

    if (!prompt || !prompt.trim()) {
      return corsResponse(NextResponse.json({ error: 'Missing prompt' }, { status: 400 }))
    }

    // Validate duration (1-20 seconds)
    if (max_duration < 1 || max_duration > 20) {
      return corsResponse(NextResponse.json({ error: 'Duration must be between 1 and 20 seconds' }, { status: 400 }))
    }

    // Validate variations (1-2)
    if (variations < 1 || variations > 2) {
      return corsResponse(NextResponse.json({ error: 'Variations must be between 1 and 2' }, { status: 400 }))
    }

    // Calculate credit cost based on duration
    // Up to 8s = 6 credits ($0.16), 9-20s = 7 credits ($0.20)
    const creditCost = max_duration <= 8 ? 6 : 7

    console.log('🔄 Looper generation request')
    console.log('💬 Prompt:', prompt)
    console.log('⏱️ Duration:', max_duration, 'seconds')
    console.log('🎵 BPM:', bpm)
    console.log('🔢 Variations:', variations)
    console.log('💰 Credit cost:', creditCost)
    console.log('🎛️ Parameters:', { model_version, output_format, classifier_free_guidance, temperature, top_k, top_p, seed })

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
    
    if (!user || user.credits < creditCost) {
      return corsResponse(NextResponse.json({ 
        error: `Insufficient credits. Looper generation requires ${creditCost} credits.`,
        creditsNeeded: creditCost,
        creditsAvailable: user?.credits || 0
      }, { status: 402 }))
    }

    console.log(`💰 User has ${user.credits} credits. Looper generation requires ${creditCost} credits.`)

    // Generate loops using MusicGen Looper
    console.log('🔄 Generating loops with MusicGen Looper...')
    
    try {
      const prediction = await replicate.predictions.create({
        model: "andreasjansson/musicgen-looper",
        version: "f8140d0457c2b39ad8728a80736fea9a67a0ec0cd37b35f40b68cce507db2366",
        input: {
          prompt: prompt,
          bpm: bpm,
          max_duration: max_duration,
          variations: variations,
          model_version: model_version,
          output_format: output_format,
          classifier_free_guidance: classifier_free_guidance,
          temperature: temperature,
          top_k: top_k,
          top_p: top_p,
          seed: seed
        }
      })

      console.log('🔄 Prediction created:', prediction.id)

      // Poll until completed (loopers can take 1-2 minutes for long durations)
      let finalPrediction = prediction
      let pollAttempts = 0
      const maxPollAttempts = 150 // 150 seconds max for loopers
      
      while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && pollAttempts < maxPollAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        finalPrediction = await replicate.predictions.get(prediction.id)
        console.log(`🔄 Status: ${finalPrediction.status} (${pollAttempts}s elapsed)`)
        pollAttempts++
      }

      if (finalPrediction.status === 'failed') {
        throw new Error(typeof finalPrediction.error === 'string' ? finalPrediction.error : 'Generation failed')
      }

      if (finalPrediction.status !== 'succeeded') {
        throw new Error('Generation timed out')
      }

      const output = finalPrediction.output as Record<string, string | null>
      
      // Extract all variations (variation_01, variation_02, etc.)
      const variationUrls: string[] = []
      for (let i = 1; i <= variations; i++) {
        const key = `variation_${i.toString().padStart(2, '0')}`
        const url = output[key]
        if (url) {
          variationUrls.push(url)
        }
      }

      if (variationUrls.length === 0) {
        throw new Error('No output URLs from MusicGen Looper')
      }

      console.log(`✅ MusicGen Looper generated ${variationUrls.length} variations`)

      // Download and upload all variations to R2
      const uploadedVariations: Array<{ url: string; variation: number }> = []
      
      for (let i = 0; i < variationUrls.length; i++) {
        const variationUrl = variationUrls[i]
        console.log(`📥 Downloading variation ${i + 1}...`)
        
        const downloadRes = await fetch(variationUrl)
        if (!downloadRes.ok) {
          console.error(`Failed to download variation ${i + 1}`)
          continue
        }

        const outputBuffer = Buffer.from(await downloadRes.arrayBuffer())
        const outputFileName = `${userId}/loop-${Date.now()}-v${i + 1}.${output_format}`
        
        const outputR2Result = await uploadToR2(
          outputBuffer,
          'audio-files',
          outputFileName
        )

        if (outputR2Result.success && outputR2Result.url) {
          uploadedVariations.push({
            url: outputR2Result.url,
            variation: i + 1
          })
          console.log(`✅ Variation ${i + 1} uploaded to R2:`, outputR2Result.url)
        } else {
          console.error(`Failed to upload variation ${i + 1} to R2`)
        }
      }

      if (uploadedVariations.length === 0) {
        throw new Error('Failed to upload any variations to R2')
      }

      // Save each variation to combined_media table
      console.log('💾 Saving variations to combined_media...')
      const savedLibraryIds: Array<{ id: string | null; variation: number }> = []
      
      for (const { url, variation } of uploadedVariations) {
        try {
          const savePayload = {
            user_id: userId,
            type: 'audio',
            title: `Loop: ${prompt.substring(0, 40)} (v${variation})`,
            audio_prompt: prompt,
            prompt: prompt,
            audio_url: url,
            image_url: null,
            is_public: true,
            genre: 'loop',
            metadata: JSON.stringify({
              bpm: bpm,
              duration: max_duration,
              variation: variation,
              model_version: model_version,
              output_format: output_format
            })
          }
          
          console.log(`💾 Saving variation ${variation}:`, JSON.stringify(savePayload, null, 2))
          
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
            console.error(`❌ Library save failed for variation ${variation}:`, errorText)
            savedLibraryIds.push({ id: null, variation })
          } else {
            const saved = await saveRes.json()
            const libraryId = saved[0]?.id || saved?.id
            console.log(`✅ Variation ${variation} saved to library:`, libraryId)
            savedLibraryIds.push({ id: libraryId, variation })
          }
        } catch (saveError) {
          console.error(`❌ Library save exception for variation ${variation}:`, saveError)
          savedLibraryIds.push({ id: null, variation })
        }
      }

      // Deduct credits using atomic function
      console.log(`💰 Deducting ${creditCost} credits from user atomically (${user.credits} → ${user.credits - creditCost})`)
      const creditDeductRes = await fetch(
        `${supabaseUrl}/rest/v1/rpc/deduct_credits`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            p_clerk_user_id: userId,
            p_amount: creditCost
          })
        }
      )

      let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
      if (creditDeductRes.ok) {
        const raw = await creditDeductRes.json()
        deductResult = Array.isArray(raw) ? raw[0] ?? null : raw
      }
      if (!creditDeductRes.ok || !deductResult?.success) {
        console.error('⚠️ Failed to deduct credits:', deductResult?.error_message || creditDeductRes.statusText)
      } else {
        console.log('✅ Credits deducted successfully')
      }

      console.log('✅ Looper generation complete')

      return corsResponse(NextResponse.json({ 
        success: true, 
        variations: uploadedVariations,
        libraryIds: savedLibraryIds,
        prompt,
        bpm,
        duration: max_duration,
        creditsUsed: creditCost,
        creditsRemaining: user.credits - creditCost,
        message: `${uploadedVariations.length} loop variations generated successfully`
      }))

    } catch (genError) {
      console.error('❌ MusicGen Looper generation failed:', genError)
      throw genError
    }

  } catch (error) {
    console.error('Looper generation error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return corsResponse(NextResponse.json(
      { error: `Failed to generate loops: ${errorMessage}` },
      { status: 500 }
    ))
  }
}
