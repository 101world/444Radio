import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'

// Allow up to 5 minutes for music generation (Vercel Pro limit: 300s)
export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
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
      // Use MiniMax Music-1.5 for English with retry logic
      const prediction = await createPredictionWithRetry(
        replicate,
        "minimax/music-1.5",
        {
          lyrics: prompt.substring(0, 600), // Max 600 characters
          style_strength: params?.style_strength ?? 0.8, // 0.0 to 1.0, default 0.8
        }
      )

      console.log('🎵 MiniMax prediction created:', prediction.id)

      finalPrediction = prediction
      let attempts = 0
      const maxAttempts = 60
      
      while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        finalPrediction = await replicate.predictions.get(prediction.id)
        console.log('🎵 Music generation status:', finalPrediction.status)
        attempts++
      }

      if (attempts >= maxAttempts) {
        throw new Error('Music generation timed out')
      }
    } else {
      // Use ACE-Step for non-English languages with retry logic
      const genreTags = prompt.toLowerCase().match(/\b(rock|pop|jazz|blues|electronic|classical|hip hop|rap|country|metal|folk|reggae|indie|funk|soul|rnb|edm|house|techno|ambient|chill|lofi)\b/g) || ['music'];
      const tags = genreTags.join(',') || 'instrumental,melodic';

      const prediction = await createPredictionWithRetry(
        replicate,
        "280fc4f9ee507577f880a167f639c02622421d8fecf492454320311217b688f1",
        {
          tags: tags,
          lyrics: prompt.substring(0, 600),
          duration: params?.duration ?? 60,
          number_of_steps: params?.quality ?? 60,
          guidance_scale: params?.adherence ?? 15,
          scheduler: 'euler',
          guidance_type: 'apg',
          seed: -1,
        }
      )

      console.log('🎵 ACE-Step prediction created:', prediction.id)

      finalPrediction = prediction
      let attempts = 0
      const maxAttempts = 60
      
      while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000))
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
    const replicateAudioUrl = Array.isArray(output) ? output[0] : output

    if (!replicateAudioUrl) {
      throw new Error('No audio generated')
    }

    console.log('🎵 Replicate audio URL:', replicateAudioUrl)

    // Download the audio file from Replicate and upload to R2 for permanent storage
    const audioResponse = await fetch(replicateAudioUrl)
    if (!audioResponse.ok) {
      throw new Error('Failed to download audio from Replicate')
    }

    const audioBlob = await audioResponse.blob()
    const audioFile = new File([audioBlob], `${songId}.mp3`, { type: 'audio/mpeg' })

    // Upload to R2
    const { uploadToR2 } = await import('@/lib/r2-upload')
    const r2Result = await uploadToR2(audioFile, 'audio-files', `${songId}.mp3`)

    if (!r2Result.success || !r2Result.url) {
      console.error('Failed to upload to R2:', r2Result.error)
      throw new Error('Failed to store audio file')
    }

    const permanentAudioUrl = r2Result.url
    console.log('✅ Audio uploaded to R2:', permanentAudioUrl)

    // Update song in database with permanent R2 URL and status
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
        audio_url: permanentAudioUrl,
        status: 'processing_cover'
      })
    })

    if (!updateRes.ok) {
      throw new Error('Failed to update song with audio URL')
    }

    console.log('✅ Music generated:', permanentAudioUrl)

    return NextResponse.json({ 
      success: true, 
      audioUrl: permanentAudioUrl,
      message: 'Music generated successfully' 
    })

  } catch (error: any) {
    console.error('Music generation error:', error)
    
    // Better error messages for users
    let errorMessage = 'Failed to generate music'
    const is502or500 = error?.message?.includes('502') || error?.message?.includes('500')
    
    if (is502or500) {
      errorMessage = 'Replicate API is temporarily unavailable. Please try again in a few minutes.'
    } else if (error?.message?.includes('timeout')) {
      errorMessage = 'Music generation timed out. Please try again with a shorter prompt.'
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

