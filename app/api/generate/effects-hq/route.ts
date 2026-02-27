import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { uploadToR2 } from '@/lib/r2-upload'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { sanitizeCreditError, SAFE_ERROR_MESSAGE } from '@/lib/sanitize-error'
import { refundCredits } from '@/lib/refund-credits'

// Allow up to 5 minutes for HQ SFX generation
export const maxDuration = 300

export async function OPTIONS() {
  return handleOptions()
}

// POST /api/generate/effects-hq — HQ Sound Effects via fal.ai CassetteAI
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const { prompt, duration = 10 } = body

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return corsResponse(NextResponse.json({ error: 'Missing prompt' }, { status: 400 }))
    }

    const trimmedPrompt = prompt.trim()
    if (trimmedPrompt.length < 10 || trimmedPrompt.length > 300) {
      return corsResponse(NextResponse.json({ error: 'Prompt must be 10-300 characters' }, { status: 400 }))
    }

    // Validate duration (1-30 seconds for HQ mode)
    const clampedDuration = Math.min(30, Math.max(1, Math.round(duration)))

    console.log('🔴 HQ Effects generation request')
    console.log('💬 Prompt:', trimmedPrompt)
    console.log('⏱️ Duration:', clampedDuration)

    // ── Check FAL_KEY ──
    const falKey = process.env.FAL_KEY || process.env.fal_key
    if (!falKey) {
      console.error('❌ FAL_KEY environment variable is not set!')
      return corsResponse(NextResponse.json({ error: 'HQ SFX service not configured' }, { status: 500 }))
    }

    // ── Check user credits (HQ costs 3) ──
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,free_credits`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const userData = await userRes.json()
    const user = userData?.[0]
    const totalCredits = (user?.credits || 0) + (user?.free_credits || 0)

    if (!user || totalCredits < 3) {
      return corsResponse(NextResponse.json({
        error: 'Insufficient credits. HQ SFX generation requires 3 credits.',
        creditsNeeded: 3,
        creditsAvailable: totalCredits
      }, { status: 402 }))
    }

    console.log(`💰 User has ${totalCredits} credits (${user?.free_credits || 0} free). HQ SFX requires 3 credits.`)

    // ── Deduct 3 credits atomically BEFORE generation ──
    const deductRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/deduct_credits`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_clerk_user_id: userId, p_amount: 3 })
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
      await logCreditTransaction({
        userId,
        amount: -3,
        type: 'generation_effects_hq',
        status: 'failed',
        description: `HQ text to sfx: ${trimmedPrompt}`,
        metadata: { prompt: trimmedPrompt, duration: clampedDuration }
      })
      return corsResponse(NextResponse.json({ error: sanitizeCreditError(errorMsg) }, { status: 402 }))
    }

    console.log(`✅ Credits deducted. Remaining: ${deductResult.new_credits}`)

    await logCreditTransaction({
      userId,
      amount: -3,
      balanceAfter: deductResult.new_credits,
      type: 'generation_effects_hq',
      description: `HQ text to sfx: ${trimmedPrompt}`,
      metadata: { prompt: trimmedPrompt, duration: clampedDuration }
    })

    // ── Generate HQ SFX via fal.ai CassetteAI ──
    console.log('🔴 Generating HQ SFX with CassetteAI/sound-effects-generator...')

    try {
      const falRes = await fetch('https://fal.run/cassetteai/sound-effects-generator', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          duration: clampedDuration
        })
      })

      if (!falRes.ok) {
        const errText = await falRes.text().catch(() => '')
        console.error(`[effects-hq] fal.ai error (${falRes.status}):`, errText)
        throw new Error(`fal.ai request failed (${falRes.status})`)
      }

      const falData = await falRes.json()
      console.log('🔴 fal.ai response:', JSON.stringify(falData).substring(0, 200))

      // Extract audio URL from response
      const audioFile = falData?.audio_file
      let outputAudioUrl: string | undefined
      if (typeof audioFile === 'string') outputAudioUrl = audioFile
      else if (audioFile?.url) outputAudioUrl = audioFile.url

      if (!outputAudioUrl) {
        console.error('[effects-hq] No audio URL in fal.ai response:', falData)
        throw new Error('No audio in fal.ai output')
      }

      console.log('✅ CassetteAI output:', outputAudioUrl)

      // ── Download and re-upload to R2 for permanent storage ──
      console.log('📥 Downloading generated HQ audio...')
      const downloadRes = await fetch(outputAudioUrl)
      if (!downloadRes.ok) {
        throw new Error('Failed to download generated audio')
      }

      const outputBuffer = Buffer.from(await downloadRes.arrayBuffer())
      const outputFileName = `${userId}/effects-hq-${Date.now()}.wav`

      const outputR2Result = await uploadToR2(
        outputBuffer,
        'audio-files',
        outputFileName,
        'audio/wav'
      )

      if (!outputR2Result.success) {
        throw new Error('Failed to upload result to R2')
      }

      console.log('✅ HQ result uploaded to R2:', outputR2Result.url)

      // ── Save to combined_media table ──
      console.log('💾 Saving HQ SFX to combined_media...')
      let libraryId = null
      let librarySaveError = null

      try {
        const savePayload = {
          user_id: userId,
          type: 'audio',
          title: `[HQ] SFX: ${trimmedPrompt.substring(0, 50)}`,
          audio_prompt: trimmedPrompt,
          prompt: trimmedPrompt,
          audio_url: outputR2Result.url,
          image_url: null,
          is_public: false,
          genre: 'effects'
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
          console.error('❌ HQ Library save failed:', librarySaveError)
        } else {
          const saved = await saveRes.json()
          libraryId = saved[0]?.id || saved?.id
          console.log('✅ HQ SFX saved to library:', libraryId)
        }
      } catch (saveError) {
        librarySaveError = saveError instanceof Error ? saveError.message : 'Unknown save error'
        console.error('❌ HQ Library save exception:', librarySaveError)
      }

      console.log('✅ HQ Effects generation complete')

      // Update transaction with output media
      updateTransactionMedia({
        userId,
        type: 'generation_effects_hq',
        mediaUrl: outputR2Result.url,
        mediaType: 'audio',
        title: `[HQ] SFX: ${trimmedPrompt.substring(0, 50)}`
      }).catch(() => {})

      // Quest progress: fire-and-forget
      const { trackQuestProgress, trackGenerationStreak } = await import('@/lib/quest-progress')
      trackQuestProgress(userId, 'generate_songs').catch(() => {})
      trackGenerationStreak(userId).catch(() => {})

      return corsResponse(NextResponse.json({
        success: true,
        audioUrl: outputR2Result.url,
        prompt: trimmedPrompt,
        duration: clampedDuration,
        creditsRemaining: deductResult!.new_credits,
        libraryId,
        librarySaveError,
        message: libraryId
          ? 'HQ sound effects generated and saved successfully'
          : 'HQ sound effects generated but not saved to library'
      }))

    } catch (genError) {
      console.error('❌ HQ CassetteAI generation failed:', genError)
      await refundCredits({
        userId,
        amount: 3,
        type: 'generation_effects_hq',
        reason: `HQ SFX failed: ${trimmedPrompt?.substring(0, 50) || 'unknown'}`,
        metadata: { prompt: trimmedPrompt, error: String(genError).substring(0, 200) }
      })
      throw genError
    }

  } catch (error) {
    console.error('HQ Effects generation error:', error)
    return corsResponse(NextResponse.json(
      { error: SAFE_ERROR_MESSAGE },
      { status: 500 }
    ))
  }
}
