import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { supabase } from '@/lib/supabase'

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
        await new Promise(resolve => setTimeout(resolve, attempt * 2000))
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

    const { prompt, duration = 60 } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    // Check if user has enough credits (5 credits required)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits, total_generated')
      .eq('clerk_user_id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (userData.credits < 5) {
      return NextResponse.json({ 
        error: 'Insufficient credits. You need 5 credits for instrumental generation.',
        creditsNeeded: 5,
        creditsAvailable: userData.credits
      }, { status: 402 })
    }

    // Deduct credits immediately
    const { error: deductError } = await supabase
      .from('users')
      .update({ 
        credits: userData.credits - 5,
        total_generated: (userData.total_generated || 0) + 1
      })
      .eq('clerk_user_id', userId)

    if (deductError) {
      console.error('Failed to deduct credits:', deductError)
      return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 })
    }

    console.log(`🎹 Starting instrumental generation for user ${userId}`)
    console.log('🎹 Prompt (tags):', prompt)
    console.log('🎹 Duration:', duration, 'seconds')
    console.log('💰 Deducted 5 credits, remaining:', userData.credits - 5)

    // Use ACE-Step for instrumental music generation
    // Model: lucataco/ace-step (as per user's request)
    // This model generates instrumental music based on text tags
    const prediction = await createPredictionWithRetry(
      replicate,
      "lucataco/ace-step:280fc4f9ee507577f880a167f639c02622421d8fecf492454320311217b688f1",
      {
        tags: prompt, // Tags describe the instrumental style
        lyrics: "[inst]", // Instrumental tag - no lyrics
        duration: Math.min(Math.max(duration, 1), 240), // Clamp between 1-240 seconds
        number_of_steps: 60, // Quality steps (default 60)
        guidance_scale: 15, // Adherence to prompt (default 15)
        scheduler: "euler",
        guidance_type: "apg",
        seed: -1 // Random seed
      }
    )

    console.log('🎹 Instrumental prediction created:', prediction.id)

    // Poll until completed
    let finalPrediction = prediction
    let attempts = 0
    const maxAttempts = 120 // 4 minutes max (240s generation can take time)

    while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      finalPrediction = await replicate.predictions.get(prediction.id)
      console.log('🎹 Instrumental generation status:', finalPrediction.status)
      attempts++
    }

    if (attempts >= maxAttempts) {
      // Refund credits on timeout
      await supabase
        .from('users')
        .update({ credits: userData.credits })
        .eq('clerk_user_id', userId)
      
      throw new Error('Instrumental generation timed out')
    }

    if (finalPrediction.status === 'failed') {
      // Refund credits on failure
      await supabase
        .from('users')
        .update({ credits: userData.credits })
        .eq('clerk_user_id', userId)
      
      const errorMsg = typeof finalPrediction.error === 'string' ? finalPrediction.error : 'Instrumental generation failed'
      throw new Error(errorMsg)
    }

    // Get the audio URL from output
    const output = finalPrediction.output
    const audioUrl = Array.isArray(output) ? output[0] : output

    if (!audioUrl) {
      // Refund credits if no audio generated
      await supabase
        .from('users')
        .update({ credits: userData.credits })
        .eq('clerk_user_id', userId)
      
      throw new Error('No audio generated')
    }

    console.log('✅ Instrumental generated:', audioUrl)
    console.log('💰 Credits charged: 5, User credits now:', userData.credits - 5)

    return NextResponse.json({ 
      success: true, 
      audioUrl,
      creditsUsed: 5,
      creditsRemaining: userData.credits - 5,
      duration,
      message: 'Instrumental music generated successfully' 
    })

  } catch (error: any) {
    console.error('Instrumental generation error:', error)
    
    // Better error messages for users
    let errorMessage = 'Failed to generate instrumental music'
    const is502or500 = error?.message?.includes('502') || error?.message?.includes('500')
    
    if (is502or500) {
      errorMessage = 'Replicate API is temporarily unavailable. Please try again in a few minutes.'
    } else if (error?.message?.includes('timeout')) {
      errorMessage = 'Instrumental generation timed out. Please try again with a shorter duration.'
    } else if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return NextResponse.json({ 
      success: false,
      error: errorMessage,
      retry: is502or500
    }, { status: 500 })
  }
}
