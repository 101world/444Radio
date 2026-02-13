import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction } from '@/lib/credit-transactions'

// Allow up to 2 minutes for audio boost processing
export const maxDuration = 120

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

export async function OPTIONS() {
  return handleOptions()
}

// POST /api/generate/audio-boost - Mix & master audio track
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const {
      audioUrl,
      trackTitle,
      bass_boost = 5,
      treble_boost = 5,
      volume_boost = 6,
      normalize = false,
      noise_reduction = true,
      output_format = 'mp3',
      bitrate = '320k',
    } = body

    if (!audioUrl) {
      return corsResponse(NextResponse.json({ error: 'Missing audio URL' }, { status: 400 }))
    }

    // Validate parameters
    if (bass_boost < -20 || bass_boost > 20) {
      return corsResponse(NextResponse.json({ error: 'Bass boost must be between -20 and 20 dB' }, { status: 400 }))
    }
    if (treble_boost < -20 || treble_boost > 20) {
      return corsResponse(NextResponse.json({ error: 'Treble boost must be between -20 and 20 dB' }, { status: 400 }))
    }
    if (volume_boost < 0 || volume_boost > 10) {
      return corsResponse(NextResponse.json({ error: 'Volume boost must be between 0 and 10' }, { status: 400 }))
    }
    if (!['mp3', 'wav', 'aac', 'ogg'].includes(output_format)) {
      return corsResponse(NextResponse.json({ error: 'Invalid output format' }, { status: 400 }))
    }
    if (!['128k', '192k', '256k', '320k'].includes(bitrate)) {
      return corsResponse(NextResponse.json({ error: 'Invalid bitrate' }, { status: 400 }))
    }

    console.log('🔊 Audio Boost request')
    console.log('🎵 Audio URL:', audioUrl)
    console.log('🎛️ Parameters:', { bass_boost, treble_boost, volume_boost, normalize, noise_reduction, output_format, bitrate })

    // Check user credits (audio boost costs 1 credit)
    const BOOST_COST = 1
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

    if (!user || user.credits < BOOST_COST) {
      return corsResponse(NextResponse.json({
        error: `Insufficient credits. Audio Boost requires ${BOOST_COST} credit.`,
        creditsNeeded: BOOST_COST,
        creditsAvailable: user?.credits || 0
      }, { status: 402 }))
    }

    console.log(`💰 User has ${user.credits} credits. Audio Boost requires ${BOOST_COST} credit.`)

    // Generate boosted audio using lucataco/audio-boost
    console.log('🔊 Processing audio with Audio Boost...')

    try {
      const boostInput = {
        audio: audioUrl,
        bass_boost,
        treble_boost,
        volume_boost,
        normalize,
        noise_reduction,
        output_format,
        bitrate,
      }

      // Use replicate.run() for automatic version resolution + built-in polling
      // Retry up to 2 times on transient "Director" errors
      let output: unknown = null
      let lastError: Error | null = null
      const MAX_RETRIES = 2

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`🔄 Retry attempt ${attempt}/${MAX_RETRIES}...`)
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
          }
          output = await replicate.run("lucataco/audio-boost", { input: boostInput })
          lastError = null
          break
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err))
          console.error(`❌ Attempt ${attempt} failed:`, lastError.message)
          // Only retry on transient Replicate infrastructure errors
          if (!lastError.message.includes('Director') && !lastError.message.includes('E6716')) {
            break
          }
        }
      }

      if (lastError) {
        throw lastError
      }

      const outputAudioUrl = typeof output === 'string' ? output : (output as Record<string, unknown>)?.url || (output as string[])?.[0]

      if (!outputAudioUrl || typeof outputAudioUrl !== 'string') {
        throw new Error('No output URL from Audio Boost')
      }

      console.log('✅ Audio Boost output:', outputAudioUrl)

      // Download and re-upload to R2 for permanent storage
      console.log('📥 Downloading boosted audio...')
      const downloadRes = await fetch(outputAudioUrl)
      if (!downloadRes.ok) {
        throw new Error('Failed to download boosted audio')
      }

      const outputBuffer = Buffer.from(await downloadRes.arrayBuffer())
      const outputFileName = `${userId}/boosted-${Date.now()}.${output_format}`

      const outputR2Result = await uploadToR2(
        outputBuffer,
        'audio-files',
        outputFileName
      )

      if (!outputR2Result.success) {
        throw new Error('Failed to upload boosted audio to R2')
      }

      console.log('✅ Boosted audio uploaded to R2:', outputR2Result.url)

      // Save to combined_media table
      console.log('💾 Saving to combined_media...')
      let libraryId = null
      let librarySaveError = null

      try {
        const savePayload = {
          user_id: userId,
          type: 'audio',
          title: trackTitle ? `${trackTitle} (Boosted)` : 'Boosted Audio',
          audio_prompt: `Audio Boost: bass=${bass_boost}dB, treble=${treble_boost}dB, vol=${volume_boost}x`,
          prompt: `Audio Boost: bass=${bass_boost}dB, treble=${treble_boost}dB, vol=${volume_boost}x`,
          audio_url: outputR2Result.url,
          image_url: null,
          is_public: false,
          genre: 'boosted'
        }

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

        if (!saveRes.ok) {
          const errorText = await saveRes.text()
          librarySaveError = `HTTP ${saveRes.status}: ${errorText}`
          console.error('❌ Library save failed:', librarySaveError)
        } else {
          const saved = await saveRes.json()
          libraryId = saved[0]?.id || saved?.id
          console.log('✅ Saved to library:', libraryId)
        }
      } catch (saveError) {
        librarySaveError = saveError instanceof Error ? saveError.message : 'Unknown save error'
        console.error('❌ Library save exception:', librarySaveError)
      }

      // Deduct credits using atomic function
      console.log(`💰 Deducting ${BOOST_COST} credit from user atomically (${user.credits} → ${user.credits - BOOST_COST})`)
      const creditDeductRes = await fetch(
        `${supabaseUrl}/rest/v1/rpc/deduct_credits`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            p_clerk_user_id: userId,
            p_amount: BOOST_COST
          })
        }
      )

      let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
      if (creditDeductRes.ok) {
        const raw = await creditDeductRes.json()
        deductResult = Array.isArray(raw) ? raw[0] ?? null : raw
      }
      if (!creditDeductRes.ok || !deductResult?.success) {
        console.error('⚠️ Failed to deduct credits:', deductResult?.error_message || creditDeductRes.statusText)
        await logCreditTransaction({ userId, amount: -BOOST_COST, type: 'generation_audio_boost', status: 'failed', description: `Audio Boost`, metadata: { bass_boost, treble_boost, volume_boost } })
      } else {
        console.log(`✅ Credits deducted. Remaining: ${deductResult.new_credits}`)
        await logCreditTransaction({ userId, amount: -BOOST_COST, balanceAfter: deductResult.new_credits, type: 'generation_audio_boost', description: `Audio Boost`, metadata: { bass_boost, treble_boost, volume_boost, bitrate, output_format } })
      }

      console.log('✅ Audio Boost complete')

      return corsResponse(NextResponse.json({
        success: true,
        audioUrl: outputR2Result.url,
        settings: { bass_boost, treble_boost, volume_boost, normalize, noise_reduction, output_format, bitrate },
        creditsRemaining: deductResult?.new_credits ?? (user.credits - BOOST_COST),
        creditsUsed: BOOST_COST,
        libraryId,
        librarySaveError,
        message: libraryId
          ? 'Audio boosted and saved successfully'
          : 'Audio boosted but not saved to library'
      }))

    } catch (genError) {
      console.error('❌ Audio Boost generation failed:', genError)
      await logCreditTransaction({ userId, amount: 0, type: 'generation_audio_boost', status: 'failed', description: `Audio Boost failed`, metadata: { error: String(genError).substring(0, 200) } })
      throw genError
    }

  } catch (error) {
    console.error('Audio Boost error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return corsResponse(NextResponse.json(
      { error: `Failed to boost audio: ${errorMessage}` },
      { status: 500 }
    ))
  }
}
