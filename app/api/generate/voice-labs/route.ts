import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { notifyGenerationComplete, notifyCreditDeduct } from '@/lib/notifications'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { headers } from 'next/headers'

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
 * Cumulative character meter billing for Voice Labs.
 * Every generation adds chars to a running meter (voice_labs_tokens column).
 * Each time the meter crosses a 1,000-char boundary â†’ 3 credits deducted.
 * Under 1,000 cumulative â†’ no charge, just logged.
 * API cost: $0.06/1K tokens. We charge $0.105/1K (3 credits = 1.75Ã— markup).
 */

/** Fire-and-forget: log to voice_labs_activity table */
async function logVoiceLabsActivity(
  userId: string, eventType: string, extra: Record<string, unknown> = {}
) {
  try {
    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0].trim()
      || h.get('x-real-ip') || h.get('cf-connecting-ip') || 'unknown'
    const ua = h.get('user-agent') || 'unknown'

    await fetch(`${supabaseUrl}/rest/v1/voice_labs_activity`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        event_type: eventType,
        ip_address: ip,
        user_agent: ua,
        ...extra,
      }),
    })
  } catch { /* never block generation */ }
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
 *   title?: string â€” name for this generation
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()

    // â”€â”€ Validate required field â”€â”€
    const text = (body.text || '').trim()
    if (!text) {
      return corsResponse(NextResponse.json({ error: 'Text is required' }, { status: 400 }))
    }
    if (text.length > 10000) {
      return corsResponse(NextResponse.json({ error: 'Text must be 10,000 characters or less' }, { status: 400 }))
    }

    // â”€â”€ Parse all parameters with defaults & validation â”€â”€
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

    // â”€â”€ Cumulative character meter billing â”€â”€
    // voice_labs_tokens column = chars used since last billing.
    // When meter crosses 1000 â†’ deduct floor(meter/1000) Ã— 3 credits, keep remainder.
    const charCount = text.length

    // Read current meter + credits
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,free_credits,voice_labs_tokens`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const users = await userRes.json()
    const currentCredits = (users?.[0]?.credits ?? 0) + (users?.[0]?.free_credits ?? 0)
    const currentMeter = users?.[0]?.voice_labs_tokens ?? 0

    const newMeter = currentMeter + charCount
    const blocksToCharge = Math.floor(newMeter / 1000)
    const creditsNeeded = blocksToCharge * 3
    const remainderMeter = newMeter % 1000

    console.log(`ðŸŽ™ï¸ Voice Labs: ${charCount} chars | meter ${currentMeter}â†’${newMeter} | ${blocksToCharge > 0 ? `charge ${creditsNeeded} cr` : 'no charge'} | remainder ${remainderMeter}`)

    // Pre-check: if we'd cross a boundary, ensure enough credits
    if (creditsNeeded > 0 && currentCredits < creditsNeeded) {
      console.error(`âŒ Insufficient credits: have ${currentCredits}, need ${creditsNeeded} (meter would hit ${newMeter})`)
      await logCreditTransaction({
        userId, amount: 0, type: 'other', status: 'failed',
        description: `Voice Labs - ${voice_id} - Insufficient Credits`,
        metadata: { text_length: charCount, voice_id, meter: currentMeter, new_meter: newMeter, credits_needed: creditsNeeded },
      })
      return corsResponse(NextResponse.json({
        error: `Need ${creditsNeeded} credits (meter at ${currentMeter} + ${charCount} chars = ${newMeter}). You have ${currentCredits}.`,
        creditsNeeded,
        creditsAvailable: currentCredits,
        meterAt: currentMeter,
      }, { status: 402 }))
    }

    // â”€â”€ Update meter + deduct credits in one PATCH â”€â”€
    const newCredits = currentCredits - creditsNeeded
    const updateBody: Record<string, number> = { voice_labs_tokens: remainderMeter }
    if (creditsNeeded > 0) updateBody.credits = newCredits

    const deductRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify(updateBody),
      }
    )

    if (!deductRes.ok) {
      console.error('âŒ Failed to update meter/credits:', deductRes.status)
      return corsResponse(NextResponse.json({ error: 'Billing error. Try again.' }, { status: 500 }))
    }

    const creditsUsed = creditsNeeded
    console.log(`âœ… Meter: ${remainderMeter}/1000 | ${creditsUsed > 0 ? `Charged ${creditsUsed} credits. Remaining: ${newCredits}` : 'No charge this generation'}`)

    if (creditsUsed > 0) {
      await logCreditTransaction({
        userId, amount: -creditsUsed, balanceAfter: newCredits,
        type: 'other',
        description: `Voice Labs TTS - ${voice_id} - ${charCount.toLocaleString()} chars (meter crossed ${blocksToCharge}Ã—1K)`,
        metadata: { text_length: charCount, voice_id, emotion, audio_format, meter_before: currentMeter, meter_after: remainderMeter, blocks_charged: blocksToCharge },
      })
    }

    // â”€â”€ Build Replicate input â”€â”€
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

    console.log('ðŸŽ™ï¸ Starting Voice Labs TTS with minimax/speech-2.8-turbo...')
    const genStartTime = Date.now()

    // Log generation start (server-side for admin)
    logVoiceLabsActivity(userId, 'generation_start', {
      text_length: text.length,
      text_snapshot: text.substring(0, 2000),
      tokens_consumed: charCount,
      voice_id,
      settings: { speed, pitch, volume, emotion, audio_format, sample_rate, bitrate, channel, language_boost },
    })

    const prediction = await replicate.predictions.create({
      model: 'minimax/speech-2.8-turbo',
      input: replicateInput,
    })

    console.log('ðŸŽ™ï¸ Prediction created:', prediction.id)

    // â”€â”€ Poll for completion â”€â”€
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
        console.log(`ðŸŽ™ï¸ TTS status: ${finalPrediction.status} (${attempts * 2}s elapsed)`)
      }
      attempts++
    }

    if (finalPrediction.status !== 'succeeded') {
      const errMsg = finalPrediction.error || `TTS ${finalPrediction.status === 'failed' ? 'failed' : 'timed out'}`
      console.error('âŒ Voice Labs TTS failed:', errMsg)
      // Refund: reverse meter + credits
      if (creditsUsed > 0) {
        await refundCredits({
          userId, amount: creditsUsed, type: 'other',
          reason: `Voice Labs TTS failed: ${title}`,
          metadata: { error: String(errMsg).substring(0, 200), chars: charCount },
        })
      }
      // Restore meter to pre-generation state
      try {
        await fetch(`${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ voice_labs_tokens: currentMeter }),
        })
      } catch { /* non-critical */ }

      logVoiceLabsActivity(userId, 'generation_failed', {
        text_length: text.length,
        text_snapshot: text.substring(0, 2000),
        tokens_consumed: charCount,
        credits_spent: creditsUsed,
        generation_duration_ms: Date.now() - genStartTime,
        voice_id,
        metadata: { error: String(errMsg).substring(0, 500), prediction_id: prediction.id },
      })

      return corsResponse(NextResponse.json({
        error: 'Generation failed. Credits have been refunded.',
        creditsRefunded: true,
      }, { status: 500 }))
    }

    // â”€â”€ Extract output URL â”€â”€
    const output = finalPrediction.output
    let audioUrl: string | null = null

    if (typeof output === 'string') {
      audioUrl = output
    } else if (output && typeof output === 'object') {
      // FileOutput has a url() method in newer Replicate SDK, but via API it's a string
      audioUrl = (output as any).url || (output as any).href || String(output)
    }

    if (!audioUrl) {
      console.error('âŒ No audio URL in output:', output)
      if (creditsUsed > 0) {
        await refundCredits({
          userId, amount: creditsUsed, type: 'other',
          reason: `Voice Labs no output: ${title}`,
          metadata: { output: JSON.stringify(output).substring(0, 200) },
        })
      }
      // Restore meter
      try {
        await fetch(`${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ voice_labs_tokens: currentMeter }),
        })
      } catch { /* non-critical */ }

      logVoiceLabsActivity(userId, 'generation_failed', {
        text_length: text.length,
        tokens_consumed: charCount,
        credits_spent: creditsUsed,
        generation_duration_ms: Date.now() - genStartTime,
        voice_id,
        metadata: { error: 'No audio URL in output', prediction_id: prediction.id },
      })

      return corsResponse(NextResponse.json({
        error: 'No audio returned from generation. Credits refunded.',
        creditsRefunded: true,
      }, { status: 500 }))
    }

    console.log('âœ… Voice Labs TTS complete! URL:', audioUrl.substring(0, 80))

    // â”€â”€ Upload to R2 for permanent storage â”€â”€
    let permanentUrl = audioUrl
    try {
      const ext = audio_format === 'pcm' ? 'raw' : audio_format
      const fileName = `voice-labs-${Date.now()}.${ext}`
      const r2Result = await downloadAndUploadToR2(audioUrl, userId, 'music', fileName)
      if (r2Result.success) {
        permanentUrl = r2Result.url
        console.log('âœ… Voice Labs audio uploaded to R2:', permanentUrl)
      }
    } catch (e) {
      console.error('âš ï¸ Failed to save to R2 (non-critical, using Replicate URL):', e)
    }

    // â”€â”€ Save generation record to combined_media â”€â”€
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
            tokens_consumed: charCount,
            credits_cost: creditsUsed,
            replicate_prediction_id: prediction.id,
          },
        }),
      })

      if (!insertRes.ok) {
        console.error('âš ï¸ Failed to save voice labs generation to DB:', insertRes.status)
      } else {
        console.log('âœ… Voice Labs generation saved to combined_media')
      }
    } catch (e) {
      console.error('âš ï¸ Failed to save generation record (non-critical):', e)
    }

    // Log generation complete (server-side for admin)
    logVoiceLabsActivity(userId, 'generation_complete', {
      text_length: text.length,
      text_snapshot: text.substring(0, 2000),
      tokens_consumed: charCount,
      credits_spent: creditsUsed,
      generation_duration_ms: Date.now() - genStartTime,
      audio_url: permanentUrl,
      voice_id,
      settings: { speed, pitch, volume, emotion, audio_format, sample_rate, bitrate, channel, language_boost },
      metadata: { prediction_id: prediction.id },
    })

    // Notify user of generation
    notifyGenerationComplete(userId, '', 'voice', title).catch(() => {})
    if (creditsUsed > 0) {
      notifyCreditDeduct(userId, creditsUsed, `Voice Labs: ${title}`).catch(() => {})
    }

    return corsResponse(NextResponse.json({
      success: true,
      audioUrl: permanentUrl,
      title,
      creditsDeducted: creditsUsed,
      creditsRemaining: creditsUsed > 0 ? newCredits : currentCredits,
      chars: charCount,
      meterAt: remainderMeter,
      meterMax: 1000,
      format: audio_format,
      predictionId: prediction.id,
    }))

  } catch (error) {
    console.error('âŒ Voice Labs error:', error)
    return corsResponse(NextResponse.json({
      error: '444 Radio is locking in, please try again in a few minutes',
    }, { status: 500 }))
  }
}
