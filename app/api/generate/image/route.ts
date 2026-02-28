import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'
import { logGeneration } from '@/lib/activity-logger'
import { updateTransactionMedia } from '@/lib/credit-transactions'

// Allow up to 5 minutes for image generation (Vercel Pro limit: 300s)
export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

async function createPredictionWithRetry(replicateClient: Replicate, version: string, input: any, maxRetries = 4) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const prediction = await replicateClient.predictions.create({ version, input })
      return prediction
    } catch (error: any) {
      const errorMessage = error?.message || String(error)
      const is502or500 = errorMessage.includes('502') || errorMessage.includes('500') || errorMessage.includes('Bad Gateway') || error?.response?.status === 502 || error?.response?.status === 500
      
      if (is502or500 && attempt < maxRetries) {
        const waitTime = attempt * 3 // 3s, 6s, 9s exponential backoff
        console.log(`⚠️ Replicate API error (attempt ${attempt}/${maxRetries}), retrying in ${waitTime}s...`)
        console.log(`   Error: ${errorMessage}`)
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000))
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

    // Generate cover art using z-image-turbo
    // Ultra-fast generation with high quality output
    console.log('🎨 Starting cover art generation with z-image-turbo for:', prompt)
    console.log('🎨 Parameters:', params)

    // Log generation activity (non-blocking)
    logGeneration(userId, 'image', {
      prompt: prompt.substring(0, 200),
      song_id: songId,
      model: 'z-image-turbo',
      params
    }).catch(err => console.error('[Image Gen] Activity log failed:', err))
    
    // Create a visual prompt for album cover
    const coverPrompt = `Album cover art for: ${prompt}. Professional music album artwork, vibrant colors, artistic, high quality, studio lighting`
    
    // Create prediction with z-image-turbo (ultra-fast, high quality)
    let prediction, finalPrediction
    try {
      prediction = await createPredictionWithRetry(
        replicate,
        "prunaai/z-image-turbo",
        {
          prompt: coverPrompt,
          width: params?.width ?? 1024,
          height: params?.height ?? 1024,
          output_format: params?.output_format ?? "jpg",
          output_quality: params?.output_quality ?? 100,
          guidance_scale: params?.guidance_scale ?? 0,
          num_inference_steps: params?.num_inference_steps ?? 8,
          go_fast: params?.go_fast ?? false
        }
      )

      console.log('🎨 Cover art prediction created:', prediction.id)

      // Poll until completed
      finalPrediction = prediction
      while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 1000)) // Poll every 1 second (fast model)
        finalPrediction = await replicate.predictions.get(prediction.id)
        console.log('🎨 Cover art generation status:', finalPrediction.status)
      }

      if (finalPrediction.status === 'failed') {
        const errorMsg = typeof finalPrediction.error === 'string' ? finalPrediction.error : 'Cover art generation failed'
        throw new Error(errorMsg)
      }
    } catch (predictionError) {
      console.error('❌ Cover art prediction error:', predictionError)
      const errorMessage = predictionError instanceof Error ? predictionError.message : String(predictionError)
      const is502Error = errorMessage.includes('502') || errorMessage.includes('Bad Gateway')
      
      throw new Error(
        is502Error 
          ? '444 radio is lockin in. Please refresh and retry again! Lock in.'
          : errorMessage
      )
    }

    // The output is a direct URL string from z-image-turbo
    const output = finalPrediction.output
    let imageUrl: string
    
    // Handle z-image-turbo output format:
    // Output is typically a direct URL string: "https://replicate.delivery/.../output.jpeg"
    if (typeof output === 'string') {
      imageUrl = output
    } else if (Array.isArray(output)) {
      const firstItem = output[0]
      imageUrl = typeof firstItem?.url === 'function' ? firstItem.url() : firstItem
    } else {
      imageUrl = output as string
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

    // Update the orchestrator's transaction with the cover art output for admin tracking
    updateTransactionMedia({
      userId,
      type: 'generation_image',
      mediaUrl: permanentImageUrl,
      mediaType: 'image',
      title: `Cover: ${prompt.substring(0, 50)}`,
      extraMeta: { model: 'z-image-turbo', song_id: songId },
    }).catch(() => {})

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

