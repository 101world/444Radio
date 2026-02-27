import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { downloadAndUploadToR2 } from '@/lib/storage'

// Allow up to 5 minutes for voice training
export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/generate/voice-train
 * 
 * Train/clone a voice using minimax/voice-cloning.
 * Costs 120 credits. Returns a voice_id that can be reused with music-01.
 * 
 * Body: { voiceFileUrl: string, name?: string, noiseReduction?: boolean, volumeNormalization?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { voiceFileUrl, name = 'Untitled Voice', noiseReduction = false, volumeNormalization = false } = await req.json()

    if (!voiceFileUrl) {
      return corsResponse(NextResponse.json({ error: 'Voice file URL is required' }, { status: 400 }))
    }

    // Validate name
    const trimmedName = (name || 'Untitled Voice').trim().substring(0, 100)

    // Check credits (voice training costs 120 credits)
    const COST = 120
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,free_credits`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    )
    const users = await userRes.json()
    if (!users || users.length === 0) {
      return corsResponse(NextResponse.json({ error: 'User not found' }, { status: 404 }))
    }
    const userCredits = (users[0].credits || 0) + (users[0].free_credits || 0)
    if (userCredits < COST) {
      return corsResponse(NextResponse.json({
        error: `Insufficient credits. Voice training requires ${COST} credits.`,
        creditsNeeded: COST,
        creditsAvailable: userCredits
      }, { status: 402 }))
    }

    // Deduct credits atomically
    const deductRes = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_clerk_user_id: userId, p_amount: COST })
    })
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) {
      const raw = await deductRes.json()
      deductResult = Array.isArray(raw) ? raw[0] ?? null : raw
    }
    if (!deductRes.ok || !deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      console.error('❌ Credit deduction blocked:', errorMsg)
      await logCreditTransaction({ userId, amount: -COST, type: 'other', status: 'failed', description: `Voice Training: ${trimmedName}`, metadata: { voiceFileUrl } })
      return corsResponse(NextResponse.json({ error: errorMsg }, { status: 402 }))
    }
    console.log(`✅ Credits deducted (${COST}). Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId, amount: -COST, balanceAfter: deductResult.new_credits, type: 'other', description: `Voice Training: ${trimmedName}`, metadata: { voiceFileUrl } })

    // Upload source audio to R2 for permanent storage (if it's a temp/replicate URL)
    let permanentSourceUrl = voiceFileUrl
    if (!voiceFileUrl.includes('444radio') && !voiceFileUrl.includes('r2.')) {
      try {
        const fileName = `voice-training-source-${Date.now()}.wav`
        const r2Result = await downloadAndUploadToR2(voiceFileUrl, userId, 'music', fileName)
        if (r2Result.success) {
          permanentSourceUrl = r2Result.url
          console.log('✅ Voice source uploaded to R2:', permanentSourceUrl)
        }
      } catch (e) {
        console.error('⚠️ Failed to save voice source to R2 (non-critical):', e)
      }
    }

    // Run voice cloning with minimax/voice-cloning
    console.log('🎤 Starting voice training with minimax/voice-cloning...')
    const prediction = await replicate.predictions.create({
      model: 'minimax/voice-cloning',
      input: {
        voice_file: voiceFileUrl,
        model: 'speech-02-turbo',
        accuracy: 0.7,
        need_noise_reduction: noiseReduction,
        need_volume_normalization: volumeNormalization,
      }
    })

    console.log('🎤 Voice training prediction created:', prediction.id)

    // Poll for completion
    let finalPrediction = prediction
    let attempts = 0
    const maxAttempts = 150 // 300s at 2s intervals

    while (
      finalPrediction.status !== 'succeeded' &&
      finalPrediction.status !== 'failed' &&
      finalPrediction.status !== 'canceled' &&
      attempts < maxAttempts
    ) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      finalPrediction = await replicate.predictions.get(prediction.id)
      console.log(`🎤 Voice training status: ${finalPrediction.status} (${attempts * 2}s elapsed)`)
      attempts++
    }

    if (finalPrediction.status !== 'succeeded') {
      const errMsg = finalPrediction.error || `Voice training ${finalPrediction.status === 'failed' ? 'failed' : 'timed out'}`
      console.error('❌ Voice training failed:', errMsg)
      // Refund credits on failure
      await refundCredits({
        userId,
        amount: COST,
        type: 'other',
        reason: `Voice training failed: ${trimmedName}`,
        metadata: { error: String(errMsg).substring(0, 200) }
      })
      return corsResponse(NextResponse.json({
        error: '444 radio is locking in, please try again in few minutes',
        creditsRefunded: true
      }, { status: 500 }))
    }

    // Extract voice_id from output
    // Output format: { model: "speech-02-turbo", preview: "https://...", voice_id: "..." }
    const output = finalPrediction.output
    console.log('🎤 Voice training output:', JSON.stringify(output))

    let voiceId: string
    let previewUrl: string | null = null

    if (typeof output === 'object' && output !== null) {
      voiceId = (output as any).voice_id || (output as any).id || ''
      previewUrl = (output as any).preview || null
    } else if (typeof output === 'string') {
      voiceId = output
    } else {
      console.error('❌ Unexpected voice training output format:', output)
      await refundCredits({
        userId,
        amount: COST,
        type: 'other',
        reason: `Voice training unexpected output: ${trimmedName}`,
        metadata: { output: JSON.stringify(output).substring(0, 200) }
      })
      return corsResponse(NextResponse.json({ error: 'Unexpected training result format', creditsRefunded: true }, { status: 500 }))
    }

    if (!voiceId) {
      console.error('❌ No voice_id in output:', output)
      await refundCredits({
        userId,
        amount: COST,
        type: 'other',
        reason: `No voice_id returned: ${trimmedName}`,
        metadata: { output: JSON.stringify(output).substring(0, 200) }
      })
      return corsResponse(NextResponse.json({ error: 'No voice ID returned from training', creditsRefunded: true }, { status: 500 }))
    }

    console.log('✅ Voice trained! voice_id:', voiceId)

    // Save to voice_trainings table
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/voice_trainings`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        clerk_user_id: userId,
        voice_id: voiceId,
        name: trimmedName,
        source_audio_url: permanentSourceUrl,
        model: 'speech-02-turbo',
        preview_url: previewUrl,
        status: 'ready',
        metadata: {
          noise_reduction: noiseReduction,
          volume_normalization: volumeNormalization,
          replicate_prediction_id: prediction.id,
        }
      })
    })

    let savedTraining: any = null
    if (insertRes.ok) {
      const data = await insertRes.json()
      savedTraining = Array.isArray(data) ? data[0] : data
      console.log('✅ Voice training saved to DB:', savedTraining?.id)
    } else {
      console.error('❌ Failed to save voice training to DB:', insertRes.status)
    }

    return corsResponse(NextResponse.json({
      success: true,
      voiceId,
      trainingId: savedTraining?.id || null,
      name: trimmedName,
      previewUrl,
      creditsDeducted: COST,
      creditsRemaining: deductResult.new_credits,
    }))

  } catch (error) {
    console.error('❌ Voice training error:', error)
    return corsResponse(NextResponse.json({
      error: '444 radio is locking in, please try again in few minutes'
    }, { status: 500 }))
  }
}
