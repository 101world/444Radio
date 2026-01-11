import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'

// Allow up to 5 minutes for video generation (Vercel Pro limit: 300s)
export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST!,
})

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

    // Generate video using Seedance-1-lite (ByteDance) with Predictions API
    // Text-to-video & image-to-video, 5s or 10s, 480p-1080p
    console.log('🎬 Starting video generation with Seedance-1-lite for:', prompt)
    console.log('🎬 Parameters:', params)
    
    // Create a visual prompt for music video
    const videoPrompt = `Music video visualization for: ${prompt}. Abstract, colorful, dynamic motion, artistic, cinematic quality, professional music video aesthetic`
    
    // Create prediction with custom parameters
    const prediction = await replicate.predictions.create({
      version: "bytedance/seedance-1-lite",
      input: {
        prompt: videoPrompt,
        duration: params?.duration ?? "5s", // Options: "5s" or "10s"
        resolution: params?.resolution ?? "720p", // Options: "480p", "720p", "1080p"
        // image_url: optional for image-to-video mode
      }
    })

    console.log('🎬 Video prediction created:', prediction.id)

    // Poll until completed (video takes longer)
    let finalPrediction = prediction
    while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 3000)) // Poll every 3 seconds
      finalPrediction = await replicate.predictions.get(prediction.id)
      console.log('🎬 Video generation status:', finalPrediction.status)
    }

    if (finalPrediction.status === 'failed') {
      const errorMsg = typeof finalPrediction.error === 'string' ? finalPrediction.error : 'Video generation failed'
      throw new Error(errorMsg)
    }

    // The output is the video URL
    const output = finalPrediction.output
    const videoUrl = Array.isArray(output) ? output[0] : output

    if (!videoUrl) {
      throw new Error('No video generated')
    }

    // Download the video from Replicate and upload to R2 for permanent storage
    console.log('⬇️ Downloading video from Replicate...')
    const videoResponse = await fetch(videoUrl)
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`)
    }
    
    const videoBlob = await videoResponse.blob()
    const videoFile = new File([videoBlob], `video-${Date.now()}.mp4`, { type: 'video/mp4' })
    
    console.log('⬆️ Uploading to R2...')
    const uploadResult = await uploadToR2(videoFile, 'videos', `video-${Date.now()}.mp4`)
    
    if (!uploadResult.success) {
      throw new Error('Failed to store video permanently')
    }
    
    const permanentVideoUrl = uploadResult.url
    console.log('✅ Video generated and stored:', permanentVideoUrl)

    // Update song in database with cover video URL
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
        cover_url: permanentVideoUrl,
        cover_prompt: videoPrompt,
        status: 'processing_final'
      })
    })

    if (!updateRes.ok) {
      throw new Error('Failed to update song with video URL')
    }

    console.log('✅ Video generated:', videoUrl)

    return NextResponse.json({ 
      success: true, 
      coverUrl: permanentVideoUrl,
      message: 'Cover video generated successfully' 
    })

  } catch (error) {
    console.error('Video generation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate cover video'
    return NextResponse.json({ 
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}

