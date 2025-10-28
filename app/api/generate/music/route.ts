import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
})

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { songId, prompt, params, language = 'english' } = await req.json()

    if (!songId || !prompt) {
      return NextResponse.json({ error: 'Missing songId or prompt' }, { status: 400 })
    }

    // Determine which model to use based on language
    const isEnglish = language.toLowerCase() === 'english' || language.toLowerCase() === 'en'
    const modelName = isEnglish ? 'MiniMax Music-1.5' : 'ACE-Step (Multi-language)'
    
    console.log(`🎵 Starting music generation with ${modelName} for language: ${language}`)
    console.log('🎵 Prompt:', prompt)
    console.log('🎵 Parameters:', params)
    
    let finalPrediction: any

    if (isEnglish) {
      // Use MiniMax Music-1.5 for English
      const prediction = await replicate.predictions.create({
        version: "minimax/music-1.5",
        input: {
          lyrics: prompt.substring(0, 600), // Max 600 characters
          style_strength: params?.style_strength ?? 0.8, // 0.0 to 1.0, default 0.8
          // reference_audio: optional for style learning
        }
      })

      console.log('🎵 Music prediction created:', prediction.id)

      // Poll until completed
      finalPrediction = prediction
      while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 2000)) // Poll every 2 seconds
        finalPrediction = await replicate.predictions.get(prediction.id)
        console.log('🎵 Music generation status:', finalPrediction.status)
      }
    } else {
      // Use ACE-Step for all other languages
      // ACE-Step supports: Chinese, Spanish, French, German, Japanese, Korean, etc.
      const prediction = await replicate.predictions.create({
        version: "lucataco/ace-step:latest",
        input: {
          prompt: prompt,
          audio_length_in_s: params?.duration ?? 30, // Duration in seconds (default 30)
          num_inference_steps: params?.quality ?? 50, // Quality: 25 (fast) to 100 (high quality), default 50
          guidance_scale: params?.adherence ?? 7.0, // Prompt adherence: 1.0 to 20.0, default 7.0
          seed: params?.seed ?? Math.floor(Math.random() * 1000000), // For reproducibility
          // ACE-Step specific parameters
          reference_audio: params?.reference_audio, // Optional: URL to reference audio for style
          denoising_strength: params?.denoising_strength ?? 0.8, // 0.0 to 1.0, default 0.8
        }
      })

      console.log('🎵 ACE-Step prediction created:', prediction.id)

      // Poll until completed (ACE-Step may take longer for high quality)
      finalPrediction = prediction
      let attempts = 0
      const maxAttempts = 60 // 2 minutes max
      
      while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)) // Poll every 2 seconds
        finalPrediction = await replicate.predictions.get(prediction.id)
        console.log('🎵 ACE-Step generation status:', finalPrediction.status)
        attempts++
      }

      if (attempts >= maxAttempts) {
        throw new Error('Music generation timed out')
      }
    }

    if (finalPrediction.status === 'failed') {
      const errorMsg = typeof finalPrediction.error === 'string' ? finalPrediction.error : 'Music generation failed'
      throw new Error(errorMsg)
    }

    // The output is the audio URL
    const output = finalPrediction.output
    const audioUrl = Array.isArray(output) ? output[0] : output

    if (!audioUrl) {
      throw new Error('No audio generated')
    }

    // Update song in database with audio URL and status
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
        audio_url: audioUrl,
        status: 'processing_cover'
      })
    })

    if (!updateRes.ok) {
      throw new Error('Failed to update song with audio URL')
    }

    console.log('✅ Music generated:', audioUrl)

    return NextResponse.json({ 
      success: true, 
      audioUrl,
      message: 'Music generated successfully' 
    })

  } catch (error) {
    console.error('Music generation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate music'
    return NextResponse.json({ 
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}

