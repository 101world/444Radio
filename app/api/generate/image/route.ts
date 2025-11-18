import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST!,
})

async function createPredictionWithRetry(replicateClient: Replicate, version: string, input: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const prediction = await replicateClient.predictions.create({ version, input })
      return prediction
    } catch (error: any) {
      const is502or500 = error?.message?.includes('502') || error?.message?.includes('500') || error?.response?.status === 502 || error?.response?.status === 500
      
      if (is502or500 && attempt < maxRetries) {
        console.log(`⚠️ Replicate API error (attempt ${attempt}/${maxRetries}), retrying in ${attempt * 2}s...`)
        await new Promise(resolve => setTimeout(resolve, attempt * 2000)) // Exponential backoff
        continue
      }
      throw error
    }
  }
  throw new Error('Failed to create prediction after retries')
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { songId, prompt, params } = await req.json()

    if (!songId || !prompt) {
      return NextResponse.json({ error: 'Missing songId or prompt' }, { status: 400 })
    }

    // Generate cover art using Flux Schnell with Predictions API
    // Fast 1-4 step generation, 12B parameters, Apache 2.0 license
    console.log('🎨 Starting cover art generation with Flux Schnell for:', prompt)
    console.log('🎨 Parameters:', params)
    
    // Create a visual prompt for album cover
    const coverPrompt = `Album cover art for: ${prompt}. Professional music album artwork, vibrant colors, artistic, high quality, studio lighting`
    
    // Create prediction with custom parameters and retry logic
    const prediction = await createPredictionWithRetry(
      replicate,
      "black-forest-labs/flux-schnell",
      {
        prompt: coverPrompt,
        num_outputs: params?.num_outputs ?? 1,
        aspect_ratio: params?.aspect_ratio ?? "1:1",
        output_format: params?.output_format ?? "webp",
        output_quality: params?.output_quality ?? 80,
        go_fast: params?.go_fast ?? true, // Use optimized fp8 quantization
        num_inference_steps: params?.num_inference_steps ?? 4, // 1-4 steps for schnell
        disable_safety_checker: false
      }
    )

    console.log('🎨 Cover art prediction created:', prediction.id)

    // Poll until completed
    let finalPrediction = prediction
    while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 1000)) // Poll every 1 second (fast model)
      finalPrediction = await replicate.predictions.get(prediction.id)
      console.log('🎨 Cover art generation status:', finalPrediction.status)
    }

    if (finalPrediction.status === 'failed') {
      const errorMsg = typeof finalPrediction.error === 'string' ? finalPrediction.error : 'Cover art generation failed'
      throw new Error(errorMsg)
    }

    // The output is an array of URLs from Flux Schnell
    const output = finalPrediction.output
    let imageUrl: string
    
    // Handle different output formats:
    // - Array of URL strings: ["https://..."]
    // - Array of objects with url(): [{url: () => "https://..."}]
    if (Array.isArray(output)) {
      const firstItem = output[0]
      // Check if it's an object with url() method
      imageUrl = typeof firstItem?.url === 'function' ? firstItem.url() : firstItem
    } else {
      imageUrl = output
    }

    if (!imageUrl) {
      throw new Error('No image generated')
    }

    // Download the image from Replicate and upload to R2 for permanent storage
    console.log('⬇️ Downloading image from Replicate...')
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`)
    }
    
    const imageBlob = await imageResponse.blob()
    const imageFile = new File([imageBlob], `cover-${Date.now()}.png`, { type: 'image/png' })
    
    console.log('⬆️ Uploading to R2...')
    const uploadResult = await uploadToR2(imageFile, 'images', `cover-${Date.now()}.png`)
    
    if (!uploadResult.success) {
      throw new Error('Failed to store image permanently')
    }
    
    const permanentImageUrl = uploadResult.url
    console.log('✅ Cover art generated and stored:', permanentImageUrl)

    // Update song in database with cover URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const updateRes = await fetch(`${supabaseUrl}/rest/v1/songs?id=eq.${songId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        cover_url: permanentImageUrl,
        cover_prompt: coverPrompt,
        status: 'processing_final'
      })
    })

    if (!updateRes.ok) {
      throw new Error('Failed to update song with cover URL')
    }

    console.log('✅ Cover art generated:', imageUrl)

    return NextResponse.json({ 
      success: true, 
      coverUrl: permanentImageUrl,
      output: [permanentImageUrl], // Return as array for consistency with Replicate format
      message: 'Cover art generated successfully' 
    })

  } catch (error: any) {
    console.error('Image generation error:', error)
    
    // Better error messages for users
    let errorMessage = 'Failed to generate cover art'
    const is502or500 = error?.message?.includes('502') || error?.message?.includes('500')
    
    if (is502or500) {
      errorMessage = 'Replicate API is temporarily unavailable. Please try again in a few minutes.'
    } else if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return NextResponse.json({ 
      success: false,
      error: errorMessage,
      retry: is502or500 // Tell frontend it can retry
    }, { status: 500 })
  }
}

