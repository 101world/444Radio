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
        }
      })

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
      // Use ACE-Step for non-English languages
      const genreTags = prompt.toLowerCase().match(/\b(rock|pop|jazz|blues|electronic|classical|hip hop|rap|country|metal|folk|reggae|indie|funk|soul|rnb|edm|house|techno|ambient|chill|lofi)\b/g) || ['music'];
      const tags = genreTags.join(',') || 'instrumental,melodic';

      const prediction = await replicate.predictions.create({
        version: "lucataco/ace-step:6b1a5b1e8e82f73fc60e3b9046e56f12b29ad3ac3f5ea43e4f3e84e638385068",
        input: {
          tags: tags,
          lyrics: prompt.substring(0, 600),
          duration: params?.duration ?? 60,
          number_of_steps: params?.quality ?? 60,
          guidance_scale: params?.adherence ?? 15,
          scheduler: 'euler',
          guidance_type: 'apg',
          seed: -1,
        }
      })

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

