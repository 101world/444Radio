import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { downloadAndUploadToR2 } from '@/lib/storage'

// Allow up to 3 minutes for TTS generation
export const maxDuration = 180

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function OPTIONS() {
  return handleOptions()
}

/**
 * Calculate credit cost based on input token count.
 * MiniMax charges $0.06 per 1000 input tokens.
 * We charge 3 credits per 1000 input tokens (rounded up, minimum 3).
 */
function calculateTokenCost(text: string): number {
  // Approximate token count: ~4 chars per token for English
  const estimatedTokens = Math.ceil(text.length / 4)
  const cost = Math.max(3, Math.ceil(estimatedTokens / 1000) * 3)
  return cost
}

/**
 * POST /api/generate/voice-labs
 *
 * Generate text-to-speech using minimax/speech-2.8-turbo.
 * Cost: 3 credits per 1000 input tokens (minimum 3 credits).
 *
 * Body: {
 *   text: string (required, max 10000 chars)
 *   voice_id?: string (default: "Wise_Woman")
 *   speed?: number (0.5-2.0, default: 1)
 *   volume?: number (0-10, default: 1)
 *   pitch?: number (-12 to 12, default: 0)
 *   emotion?: string (default: "auto")
 *   english_normalization?: boolean (default: false)
 *   sample_rate?: number (default: 32000)
 *   bitrate?: number (default: 128000)
 *   audio_format?: string (default: "mp3")
 *   channel?: string (default: "mono")
 *   subtitle_enable?: boolean (default: false)
 *   language_boost?: string (default: "None")
 *   title?: string — name for this generation
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()

    // ── Validate required field ──
    const text = (body.text || '').trim()
    if (!text) {
      return corsResponse(NextResponse.json({ error: 'Text is required' }, { status: 400 }))
    }
    if (text.length > 10000) {
      return corsResponse(NextResponse.json({ error: 'Text must be 10,000 characters or less' }, { status: 400 }))
    }

    // ── Parse all parameters with defaults & validation ──
    const voice_id = (body.voice_id || 'Wise_Woman').trim()
    const speed = Math.max(0.5, Math.min(2, Number(body.speed) || 1))
    const volume = Math.max(0, Math.min(10, Number(body.volume) || 1))
    const pitch = Math.max(-12, Math.min(12, Math.round(Number(body.pitch) || 0)))

    const validEmotions = ['auto', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'fluent', 'neutral']
    const emotion = validEmotions.includes(body.emotion) ? body.emotion : 'auto'

    const english_normalization = body.english_normalization === true
    
    const validSampleRates = [8000, 16000, 22050, 24000, 32000, 44100]
    const sample_rate = validSampleRates.includes(Number(body.sample_rate)) ? Number(body.sample_rate) : 32000

    const validBitrates = [32000, 64000, 128000, 256000]
    const bitrate = validBitrates.includes(Number(body.bitrate)) ? Number(body.bitrate) : 128000

    const validFormats = ['mp3', 'wav', 'flac', 'pcm']
    const audio_format = validFormats.includes(body.audio_format) ? body.audio_format : 'mp3'

    const validChannels = ['mono', 'stereo']
    const channel = validChannels.includes(body.channel) ? body.channel : 'mono'

    const subtitle_enable = body.subtitle_enable === true

    const validLanguages = [
      'None', 'Automatic', 'Chinese', 'Chinese,Yue', 'Cantonese', 'English',
      'Arabic', 'Russian', 'Spanish', 'French', 'Portuguese', 'German', 'Turkish',
      'Dutch', 'Ukrainian', 'Vietnamese', 'Indonesian', 'Japanese', 'Italian',
      'Korean', 'Thai', 'Polish', 'Romanian', 'Greek', 'Czech', 'Finnish',
      'Hindi', 'Bulgarian', 'Danish', 'Hebrew', 'Malay', 'Persian', 'Slovak',
      'Swedish', 'Croatian', 'Filipino', 'Hungarian', 'Norwegian', 'Slovenian',
      'Catalan', 'Nynorsk', 'Tamil', 'Afrikaans'
    ]
    const language_boost = validLanguages.includes(body.language_boost) ? body.language_boost : 'None'

    const title = (body.title || 'Untitled Voice Generation').trim().substring(0, 200)

    // ── Calculate cost ──
    const cost = calculateTokenCost(text)
    console.log(`🎙️ Voice Labs: ${text.length} chars, ~${Math.ceil(text.length / 4)} tokens → ${cost} credits`)

    // ── Check credits ──
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const users = await userRes.json()
    if (!users || users.length === 0) {
      return corsResponse(NextResponse.json({ error: 'User not found' }, { status: 404 }))
    }
    const userCredits = users[0].credits || 0
    if (userCredits < cost) {
      return corsResponse(NextResponse.json({
        error: `Insufficient credits. This generation requires ${cost} credits (3 per 1K tokens).`,
        creditsNeeded: cost,
        creditsAvailable: userCredits,
        estimatedTokens: Math.ceil(text.length / 4),
      }, { status: 402 }))
    }

    // ── Deduct credits ──
    const deductRes = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_clerk_user_id: userId, p_amount: cost }),
    })
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) {
      const raw = await deductRes.json()
      deductResult = Array.isArray(raw) ? raw[0] ?? null : raw
    }
    if (!deductRes.ok || !deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      console.error('❌ Credit deduction blocked:', errorMsg)
      await logCreditTransaction({
        userId, amount: -cost, type: 'other', status: 'failed',
        description: `Voice Labs - ${voice_id} - Generation`,
        metadata: { text_length: text.length, voice_id },
      })
      return corsResponse(NextResponse.json({ error: errorMsg }, { status: 402 }))
    }
    console.log(`✅ Credits deducted (${cost}). Remaining: ${deductResult.new_credits}`)

    await logCreditTransaction({
      userId, amount: -cost, balanceAfter: deductResult.new_credits,
      type: 'other',
      description: `Voice Labs - ${voice_id} - Generation`,
      metadata: { text_length: text.length, voice_id, emotion, audio_format, estimated_tokens: Math.ceil(text.length / 4) },
    })

    // ── Build Replicate input ──
    const replicateInput: Record<string, unknown> = {
      text,
      voice_id,
      speed,
      volume,
      pitch,
      emotion,
      english_normalization,
      sample_rate,
      bitrate,
      audio_format,
      channel,
      subtitle_enable,
      language_boost,
    }

    console.log('🎙️ Starting Voice Labs TTS with minimax/speech-2.8-turbo...')
    const prediction = await replicate.predictions.create({
      model: 'minimax/speech-2.8-turbo',
      input: replicateInput,
    })

    console.log('🎙️ Prediction created:', prediction.id)

    // ── Poll for completion ──
    let finalPrediction = prediction
    let attempts = 0
    const maxAttempts = 90 // 180s at 2s intervals

    while (
      finalPrediction.status !== 'succeeded' &&
      finalPrediction.status !== 'failed' &&
      finalPrediction.status !== 'canceled' &&
      attempts < maxAttempts
    ) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      finalPrediction = await replicate.predictions.get(prediction.id)
      if (attempts % 5 === 0) {
        console.log(`🎙️ TTS status: ${finalPrediction.status} (${attempts * 2}s elapsed)`)
      }
      attempts++
    }

    if (finalPrediction.status !== 'succeeded') {
      const errMsg = finalPrediction.error || `TTS ${finalPrediction.status === 'failed' ? 'failed' : 'timed out'}`
      console.error('❌ Voice Labs TTS failed:', errMsg)
      await refundCredits({
        userId, amount: cost, type: 'other',
        reason: `Voice Labs TTS failed: ${title}`,
        metadata: { error: String(errMsg).substring(0, 200) },
      })
      return corsResponse(NextResponse.json({
        error: 'Generation failed. Credits have been refunded.',
        creditsRefunded: true,
      }, { status: 500 }))
    }

    // ── Extract output URL ──
    const output = finalPrediction.output
    let audioUrl: string | null = null

    if (typeof output === 'string') {
      audioUrl = output
    } else if (output && typeof output === 'object') {
      // FileOutput has a url() method in newer Replicate SDK, but via API it's a string
      audioUrl = (output as any).url || (output as any).href || String(output)
    }

    if (!audioUrl) {
      console.error('❌ No audio URL in output:', output)
      await refundCredits({
        userId, amount: cost, type: 'other',
        reason: `Voice Labs no output: ${title}`,
        metadata: { output: JSON.stringify(output).substring(0, 200) },
      })
      return corsResponse(NextResponse.json({
        error: 'No audio returned from generation. Credits refunded.',
        creditsRefunded: true,
      }, { status: 500 }))
    }

    console.log('✅ Voice Labs TTS complete! URL:', audioUrl.substring(0, 80))

    // ── Upload to R2 for permanent storage ──
    let permanentUrl = audioUrl
    try {
      const ext = audio_format === 'pcm' ? 'raw' : audio_format
      const fileName = `voice-labs-${Date.now()}.${ext}`
      const r2Result = await downloadAndUploadToR2(audioUrl, userId, 'music', fileName)
      if (r2Result.success) {
        permanentUrl = r2Result.url
        console.log('✅ Voice Labs audio uploaded to R2:', permanentUrl)
      }
    } catch (e) {
      console.error('⚠️ Failed to save to R2 (non-critical, using Replicate URL):', e)
    }

    // ── Save generation record to combined_media ──
    try {
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          user_id: userId,
          title: title,
          type: 'audio',
          audio_url: permanentUrl,
          is_public: false,
          genre: 'voice-over',
          metadata: {
            source: 'voice-labs',
            voice_id,
            emotion,
            speed,
            pitch,
            volume,
            audio_format,
            sample_rate,
            bitrate,
            channel,
            language_boost,
            text_length: text.length,
            estimated_tokens: Math.ceil(text.length / 4),
            credits_cost: cost,
            replicate_prediction_id: prediction.id,
          },
        }),
      })

      if (!insertRes.ok) {
        console.error('⚠️ Failed to save voice labs generation to DB:', insertRes.status)
      } else {
        console.log('✅ Voice Labs generation saved to combined_media')
      }
    } catch (e) {
      console.error('⚠️ Failed to save generation record (non-critical):', e)
    }

    return corsResponse(NextResponse.json({
      success: true,
      audioUrl: permanentUrl,
      title,
      creditsDeducted: cost,
      creditsRemaining: deductResult.new_credits,
      estimatedTokens: Math.ceil(text.length / 4),
      format: audio_format,
      predictionId: prediction.id,
    }))

  } catch (error) {
    console.error('❌ Voice Labs error:', error)
    return corsResponse(NextResponse.json({
      error: '444 Radio is locking in, please try again in a few minutes',
    }, { status: 500 }))
  }
}
