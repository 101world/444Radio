import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { sanitizeCreditError, SAFE_ERROR_MESSAGE } from '@/lib/sanitize-error'
import { refundCredits } from '@/lib/refund-credits'

// Allow up to 3 minutes for Chords generation
export const maxDuration = 180

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

export async function OPTIONS() {
  return handleOptions()
}

// POST /api/generate/musicongen - Generate music with chord progressions and rhythm control
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const { 
      prompt, 
      text_chords = 'C G A:min F',
      bpm = 120,
      time_sig = '4/4',
      duration = 15,
      top_k = 250,
      top_p = 0,
      temperature = 1,
      classifier_free_guidance = 3,
      seed,
      output_format = 'wav'
    } = body

    if (!prompt || !prompt.trim()) {
      return corsResponse(NextResponse.json({ error: 'Missing prompt' }, { status: 400 }))
    }

    // Validate duration (1-30 seconds)
    if (duration < 1 || duration > 30) {
      return corsResponse(NextResponse.json({ error: 'Duration must be between 1 and 30 seconds' }, { status: 400 }))
    }

    // Calculate credit cost - 4 credits for all durations
    const creditCost = 4

    console.log('🎹 Chords generation request')
    console.log('💬 Prompt:', prompt)
    console.log('🎵 Chords:', text_chords)
    console.log('⏱️ Duration:', duration, 'seconds')
    console.log('🎼 BPM:', bpm, '| Time Sig:', time_sig)
    console.log('💰 Credit cost:', creditCost)
    console.log('🎛️ Parameters:', { top_k, top_p, temperature, classifier_free_guidance, seed, output_format })

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
        error: `Insufficient credits. Chords generation requires ${creditCost} credits.`,
        creditsNeeded: creditCost,
        creditsAvailable: user?.credits || 0
      }, { status: 402 }))
    }

    console.log(`💰 User has ${user.credits} credits. Chords generation requires ${creditCost} credits.`)

    // ✅ DEDUCT credits atomically BEFORE generation (blocks if wallet < $1)
    const deductRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/deduct_credits`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_clerk_user_id: userId, p_amount: creditCost })
      }
    )
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) {
      const raw = await deductRes.json()
      deductResult = Array.isArray(raw) ? raw[0] ?? null : raw
    }
    if (!deductRes.ok || !deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      console.error('❌ Credit deduction blocked:', errorMsg)
      await logCreditTransaction({ userId, amount: -creditCost, type: 'generation_chords', status: 'failed', description: `Chords: ${prompt}`, metadata: { prompt, text_chords, bpm, time_sig } })
      return corsResponse(NextResponse.json({ error: sanitizeCreditError(errorMsg) }, { status: 402 }))
    }
    console.log(`✅ Credits deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId, amount: -creditCost, balanceAfter: deductResult.new_credits, type: 'generation_chords', description: `Chords: ${prompt}`, metadata: { prompt, text_chords, bpm, time_sig } })

    // Generate music using Chords
    console.log('🎹 Generating music with chords (chord control)...')
    
    try {
      const input: Record<string, any> = {
        prompt: prompt,
        text_chords: text_chords,
        bpm: bpm,
        time_sig: time_sig,
        duration: duration,
        top_k: top_k,
        top_p: top_p,
        temperature: temperature,
        classifier_free_guidance: classifier_free_guidance,
        output_format: output_format
      }

      // Only include seed if explicitly provided
      if (seed !== undefined && seed !== null && seed !== -1) {
        input.seed = seed
      }

      const prediction = await replicate.predictions.create({
        model: "sakemin/musicongen",
        version: "a05ec8bdf5cc902cd849077d985029ce9b05e3dfb98a2d74accc9c94fdf15747",
        input: input
      })

      console.log('🔄 Prediction created:', prediction.id)

      // Poll until completed
      let finalPrediction = prediction
      let pollAttempts = 0
      const maxPollAttempts = 120 // 120 seconds max
      
      while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && pollAttempts < maxPollAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        finalPrediction = await replicate.predictions.get(prediction.id)
        console.log(`🔄 Status: ${finalPrediction.status} (${pollAttempts}s elapsed)`)
        pollAttempts++
      }

      if (finalPrediction.status === 'failed') {
        throw new Error(typeof finalPrediction.error === 'string' ? (console.error('[musicongen] Prediction failed:', finalPrediction.error), SAFE_ERROR_MESSAGE) : SAFE_ERROR_MESSAGE)
      }

      if (finalPrediction.status !== 'succeeded') {
        throw new Error('Generation timed out')
      }

      const outputUrl = finalPrediction.output as string
      
      if (!outputUrl) {
        throw new Error('No output URL from Chords generation')
      }

      console.log(`✅ Chords generated audio`)

      // Download and upload to R2
      console.log(`📥 Downloading audio...`)
      
      const downloadRes = await fetch(outputUrl)
      if (!downloadRes.ok) {
        throw new Error('Failed to download generated audio')
      }

      const outputBuffer = Buffer.from(await downloadRes.arrayBuffer())
      const outputFileName = `${userId}/chords-${Date.now()}.${output_format}`
      
      const outputR2Result = await uploadToR2(
        outputBuffer,
        'audio-files',
        outputFileName
      )

      if (!outputR2Result.success || !outputR2Result.url) {
        throw new Error('Failed to upload audio to R2')
      }

      console.log(`✅ Audio uploaded to R2:`, outputR2Result.url)

      // Save to combined_media table
      console.log('💾 Saving to combined_media...')
      
      const savePayload = {
        user_id: userId,
        type: 'audio',
        title: `${prompt.substring(0, 40)}`,
        audio_prompt: prompt,
        prompt: prompt,
        audio_url: outputR2Result.url,
        image_url: null,
        is_public: false,
        genre: 'chords',
        bpm: bpm,
        chord_progression: text_chords,
        time_signature: time_sig,
        metadata: JSON.stringify({
          text_chords: text_chords,
          time_sig: time_sig,
          duration: duration,
          output_format: output_format,
          model: 'chords',
          temperature: temperature,
          top_k: top_k,
          classifier_free_guidance: classifier_free_guidance
        })
      }
      
      console.log(`💾 Saving:`, JSON.stringify(savePayload, null, 2))
      
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

      let libraryId: string | null = null
      if (!saveRes.ok) {
        const errorText = await saveRes.text()
        console.error(`❌ Library save failed:`, errorText)
      } else {
        const saved = await saveRes.json()
        libraryId = saved[0]?.id || saved?.id
        console.log(`✅ Saved to library:`, libraryId)
      }

      console.log('✅ Chords generation complete')

      // Update transaction with output media
      updateTransactionMedia({ 
        userId, 
        type: 'generation_chords', 
        mediaUrl: outputR2Result.url, 
        mediaType: 'audio', 
        title: `${prompt.substring(0, 50)}`,
        extraMeta: { text_chords, bpm, time_sig }
      }).catch(() => {})

      // Quest progress: fire-and-forget
      const { trackQuestProgress } = await import('@/lib/quest-progress')
      trackQuestProgress(userId, 'generate_songs').catch(() => {})

      return corsResponse(NextResponse.json({ 
        success: true, 
        audioUrl: outputR2Result.url,
        libraryId: libraryId,
        prompt,
        text_chords,
        bpm,
        time_sig,
        duration,
        creditsUsed: creditCost,
        creditsRemaining: deductResult!.new_credits,
        message: libraryId 
          ? 'Music generated and saved successfully'
          : 'Music generated but not saved to library'
      }))

    } catch (genError) {
      console.error('❌ Chords generation failed:', genError)
      await refundCredits({ 
        userId, 
        amount: creditCost, 
        type: 'generation_chords', 
        reason: `Chords generation failed: ${prompt?.substring(0, 50) || 'unknown'}`, 
        metadata: { prompt, text_chords, bpm, time_sig, error: String(genError).substring(0, 200) } 
      })
      throw genError
    }

  } catch (error) {
    console.error('Chords generation error:', error)
    
    return corsResponse(NextResponse.json(
      { error: SAFE_ERROR_MESSAGE },
      { status: 500 }
    ))
  }
}
