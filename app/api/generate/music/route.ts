import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { trackQuestProgress } from '@/lib/quest-progress'
import { SAFE_ERROR_MESSAGE } from '@/lib/sanitize-error'
import { logGeneration } from '@/lib/activity-logger'
import { updateTransactionMedia } from '@/lib/credit-transactions'

// Allow up to 5 minutes for music generation (Vercel Pro limit: 300s)
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

    // Credit check — this endpoint has no deduction logic (the caller /api/generate/route.ts handles it)
    // but we still verify the user has credits to prevent direct API abuse
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const creditCheck = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,free_credits`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )
    if (creditCheck.ok) {
      const userData = await creditCheck.json()
      const totalCredits = (userData?.[0]?.credits ?? 0) + (userData?.[0]?.free_credits ?? 0)
      if (totalCredits < 1) {
        return NextResponse.json({ error: 'Insufficient credits', success: false }, { status: 402 })
      }
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

    // Log generation activity (non-blocking)
    logGeneration(userId, 'music', {
      prompt: prompt.substring(0, 200), // Truncate for storage
      language,
      model: modelName,
      song_id: songId,
      params
    }).catch(err => console.error('[Music Gen] Activity log failed:', err))
    
    let finalPrediction: any

    if (isEnglish) {
      // Use MiniMax Music-1.5 for English with retry logic
      const prediction = await createPredictionWithRetry(
        replicate,
        "minimax/music-1.5",
        {
          lyrics: prompt.substring(0, 600), // Max 600 characters
          style_strength: params?.style_strength ?? 0.8, // 0.0 to 1.0, default 0.8
          audio_format: 'wav', // WAV output for lossless quality
        }
      )

      console.log('🎵 MiniMax prediction created:', prediction.id)

      finalPrediction = prediction
      let attempts = 0
      const maxAttempts = 135 // 270 seconds total (135 * 2s intervals) to accommodate long generations
      
      while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        finalPrediction = await replicate.predictions.get(prediction.id)
        console.log(`🎵 Music generation status: ${finalPrediction.status} (${attempts * 2}s elapsed)`)
        attempts++
      }

      if (attempts >= maxAttempts) {
        console.error(`⏰ Music generation timed out after ${attempts * 2} seconds`)
        throw new Error('Music generation timed out after 270 seconds. The generation may still complete on Replicate.')
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
      const maxAttempts = 135 // 270 seconds total (135 * 2s intervals) to accommodate long generations
      
      while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        finalPrediction = await replicate.predictions.get(prediction.id)
        console.log(`🎵 ACE-Step generation status: ${finalPrediction.status} (${attempts * 2}s elapsed)`)
        attempts++
      }

      if (attempts >= maxAttempts) {
        console.error(`⏰ ACE-Step generation timed out after ${attempts * 2} seconds`)
        throw new Error('Music generation timed out after 270 seconds. The generation may still complete on Replicate.')
      }
    }

    if (finalPrediction.status === 'failed') {
      console.error('[music] Prediction failed:', finalPrediction.error)
      throw new Error(SAFE_ERROR_MESSAGE)
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
    const audioFile = new File([audioBlob], `${songId}.wav`, { type: 'audio/wav' })

    // Upload to R2
    const { uploadToR2 } = await import('@/lib/r2-upload')
    const r2Result = await uploadToR2(audioFile, 'audio-files', `${songId}.wav`)

    if (!r2Result.success || !r2Result.url) {
      console.error('Failed to upload to R2:', r2Result.error)
      throw new Error('Failed to store audio file')
    }

    const permanentAudioUrl = r2Result.url
    console.log('✅ Audio uploaded to R2:', permanentAudioUrl)

    // Update the orchestrator's transaction with the audio output for admin tracking
    updateTransactionMedia({
      userId,
      type: 'generation_image', // Matches orchestrator's logged type
      mediaUrl: permanentAudioUrl,
      mediaType: 'audio',
      title: `Music: ${prompt.substring(0, 50)}`,
      extraMeta: { model: isEnglish ? 'minimax-music-1.5' : 'ace-step', language, song_id: songId },
    }).catch(() => {})

    // Update song in database with permanent R2 URL and status
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

    // Register in 444 Ownership Engine (fingerprint + lineage)
    try {
      const { processNewTrack } = await import('@/lib/ownership-engine')
      const audioBuffer = await audioBlob.arrayBuffer()
      const ownershipResult = await processNewTrack({
        trackId: songId,
        userId,
        audioBuffer: Buffer.from(audioBuffer),
        prompt: prompt,
        model: modelName,
        licenseType: 'fully_ownable',
        trackMetadata: { title: songId, generationPrompt: prompt, generationModel: modelName },
      })
      console.log('✅ 444 Ownership registered:', ownershipResult.trackId444, 'Strength:', ownershipResult.metadataStrength)
    } catch (e) {
      console.error('444 Ownership registration failed (non-critical):', e)
    }

    // Quest progress: fire-and-forget
    const { trackModelUsage, trackGenerationStreak } = await import('@/lib/quest-progress')
    trackQuestProgress(userId, 'generate_songs').catch(() => {})
    trackModelUsage(userId, modelName.toLowerCase().replace(/[^a-z0-9]/g, '-')).catch(() => {})
    trackGenerationStreak(userId).catch(() => {})

    return NextResponse.json({ 
      success: true, 
      audioUrl: permanentAudioUrl,
      message: 'Music generated successfully' 
    })

  } catch (error: any) {
    console.error('Music generation error:', error)
    
    return NextResponse.json({ 
      success: false,
      error: SAFE_ERROR_MESSAGE,
      retry: error?.message?.includes('502') || error?.message?.includes('500')
    }, { status: 500 })
  }
}

