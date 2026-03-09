import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { notifyGenerationComplete, notifyGenerationFailed, notifyCreditDeduct } from '@/lib/notifications'
import { generateMusic, pollTaskUntilDone, sanitizeSunoError, SUNO_CREDIT_COSTS, type SunoModel } from '@/lib/suno-api'

export const maxDuration = 300

const CREDIT_COST = SUNO_CREDIT_COSTS.generate // 20 credits
const DEFAULT_MODEL: SunoModel = 'V5'

/**
 * POST /api/generate/suno/generate
 *
 * 444 Pro Music — Hindi / Urdu / Arabic / Tamil / Telugu / Punjabi generation
 * via Suno API. Returns NDJSON stream. Costs 20 credits per generation (2 tracks).
 *
 * Body: { title, prompt, lyrics, genre, language, instrumental?, model?, vocalGender? }
 */
export async function POST(req: NextRequest) {
  console.log('🎵 [444-PRO] POST /api/generate/suno/generate')
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      title,
      prompt,
      lyrics,
      genre,
      language = 'hindi',
      instrumental = false,
      model,
      vocalGender,
    } = body

    // ---------- Validation ----------
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return NextResponse.json({ error: 'Prompt required (at least 3 characters)' }, { status: 400 })
    }
    if (!title || typeof title !== 'string' || title.trim().length < 1) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const cleanTitle = title.trim().slice(0, 80)
    const cleanPrompt = prompt.trim().slice(0, 3000)
    const cleanStyle = genre?.trim().slice(0, 1000) || undefined
    const cleanLyrics = lyrics?.trim() || undefined
    const isCustomMode = !!(cleanLyrics || cleanStyle)

    console.log('🎵 [444-PRO] Generation request:', {
      title: cleanTitle,
      language,
      genre: cleanStyle,
      instrumental,
      isCustomMode,
      model: model || DEFAULT_MODEL,
      promptLen: cleanPrompt.length,
      lyricsLen: cleanLyrics?.length || 0,
    })

    // ---------- Credit check & deduction ----------
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,free_credits`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    )
    const users = await userRes.json()
    if (!users?.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const totalCredits = (users[0].credits || 0) + (users[0].free_credits || 0)
    if (totalCredits < CREDIT_COST) {
      return NextResponse.json({
        error: `Insufficient credits. Pro music generation requires ${CREDIT_COST} credits.`,
        creditsNeeded: CREDIT_COST,
        creditsAvailable: totalCredits,
      }, { status: 402 })
    }

    // Deduct atomically
    const deductRes = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_clerk_user_id: userId, p_amount: CREDIT_COST }),
    })
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) {
      const raw = await deductRes.json()
      deductResult = Array.isArray(raw) ? raw[0] ?? null : raw
    }
    if (!deductRes.ok || !deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      console.error('❌ Credit deduction blocked:', errorMsg)
      await logCreditTransaction({ userId, amount: -CREDIT_COST, type: 'generation_music', status: 'failed', description: `Pro Music: ${cleanTitle}`, metadata: { prompt: cleanPrompt, genre: cleanStyle, language } })
      return NextResponse.json({ error: errorMsg }, { status: 402 })
    }
    console.log(`✅ Credits deducted (${CREDIT_COST}). Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId, amount: -CREDIT_COST, balanceAfter: deductResult.new_credits, type: 'generation_music', description: `Pro Music: ${cleanTitle}`, metadata: { prompt: cleanPrompt, genre: cleanStyle, language, engine: '444-pro' } })

    // ---------- NDJSON stream ----------
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    let clientDisconnected = false

    const sendLine = async (data: Record<string, unknown>) => {
      if (clientDisconnected) return
      try {
        await writer.write(encoder.encode(JSON.stringify(data) + '\n'))
      } catch {
        clientDisconnected = true
      }
    }

    ;(async () => {
      try {
        await sendLine({ type: 'started', model: '444-pro-music' })

        // Build Suno generate params
        const sunoParams: Record<string, unknown> = {
          customMode: isCustomMode,
          instrumental,
          model: model || DEFAULT_MODEL,
          callBackUrl: '',
        }

        if (isCustomMode) {
          sunoParams.style = cleanStyle || language
          sunoParams.title = cleanTitle
          if (!instrumental && cleanLyrics) {
            sunoParams.prompt = cleanLyrics
          } else if (!instrumental) {
            sunoParams.prompt = cleanPrompt
          }
        } else {
          sunoParams.prompt = cleanPrompt.slice(0, 500)
        }

        if (vocalGender) sunoParams.vocalGender = vocalGender

        console.log('🎵 [444-PRO] Calling engine...', { customMode: isCustomMode, model: model || DEFAULT_MODEL })

        const taskRes = await generateMusic(sunoParams as any)
        const taskId = taskRes.data.taskId
        console.log('🎵 [444-PRO] Task created:', taskId)

        await sendLine({ type: 'progress', message: 'Your track is being crafted...', taskId })

        // Poll until complete
        const completed = await pollTaskUntilDone(taskId, 600_000, 15_000)
        const tracks = completed.data.response?.data || []

        if (!tracks.length) {
          throw new Error('No tracks returned from generation')
        }

        const track = tracks[0]
        const audioSourceUrl = track.audio_url
        if (!audioSourceUrl) {
          throw new Error('No audio URL in generated track')
        }

        console.log('🎵 [444-PRO] Track 1 ready:', track.title, 'Duration:', track.duration)

        await sendLine({ type: 'progress', message: 'Saving your tracks...' })

        // Download Track 1 to R2
        const fileName1 = `pro-${cleanTitle.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-1-${Date.now()}.wav`
        const r2Result = await downloadAndUploadToR2(audioSourceUrl, userId, 'music', fileName1)
        if (!r2Result.success) {
          throw new Error(`Failed to save to permanent storage: ${r2Result.error}`)
        }
        const permanentAudioUrl = r2Result.url
        console.log('✅ R2 upload (Track 1):', permanentAudioUrl)

        // Download Track 2 if available
        let permanentAudioUrl2: string | null = null
        const track2 = tracks[1]
        if (track2?.audio_url) {
          console.log('🎵 [444-PRO] Track 2 ready:', track2.title, 'Duration:', track2.duration)
          const fileName2 = `pro-${cleanTitle.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-2-${Date.now()}.wav`
          const r2Result2 = await downloadAndUploadToR2(track2.audio_url, userId, 'music', fileName2)
          if (r2Result2.success) {
            permanentAudioUrl2 = r2Result2.url
            console.log('✅ R2 upload (Track 2):', permanentAudioUrl2)
          } else {
            console.error('⚠️ Failed to save Track 2:', r2Result2.error)
          }
        }

        // Save Track 1 to music_library
        const libraryEntry = {
          clerk_user_id: userId,
          title: cleanTitle,
          prompt: cleanPrompt,
          lyrics: cleanLyrics || track.lyric || '',
          audio_url: permanentAudioUrl,
          audio_format: 'wav',
          bitrate: 256000,
          sample_rate: 44100,
          generation_params: { model: model || DEFAULT_MODEL, language, source: 'pro', engine: '444-pro', trackNumber: 1 },
          status: 'ready',
        }
        const saveRes = await fetch(`${supabaseUrl}/rest/v1/music_library`, {
          method: 'POST',
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify(libraryEntry),
        })
        let savedMusic: any = null
        if (saveRes.ok) {
          const d = await saveRes.json()
          savedMusic = Array.isArray(d) ? d[0] : d
          console.log('✅ Saved Track 1 to music_library:', savedMusic?.id)
        }

        // Save Track 2 to music_library (if available)
        let savedMusic2: any = null
        if (permanentAudioUrl2) {
          const libraryEntry2 = {
            clerk_user_id: userId,
            title: `${cleanTitle} (Take 2)`,
            prompt: cleanPrompt,
            lyrics: cleanLyrics || track2?.lyric || '',
            audio_url: permanentAudioUrl2,
            audio_format: 'wav',
            bitrate: 256000,
            sample_rate: 44100,
            generation_params: { model: model || DEFAULT_MODEL, language, source: 'pro', engine: '444-pro', trackNumber: 2 },
            status: 'ready',
          }
          const saveRes2 = await fetch(`${supabaseUrl}/rest/v1/music_library`, {
            method: 'POST',
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
            body: JSON.stringify(libraryEntry2),
          })
          if (saveRes2.ok) {
            const d = await saveRes2.json()
            savedMusic2 = Array.isArray(d) ? d[0] : d
            console.log('✅ Saved Track 2 to music_library:', savedMusic2?.id)
          }
        }

        // Save Track 1 to combined_media
        let savedCombined: any = null
        try {
          const cmRes = await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
            method: 'POST',
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
            body: JSON.stringify({
              user_id: userId,
              type: 'audio',
              title: cleanTitle,
              audio_prompt: cleanPrompt,
              lyrics: cleanLyrics || track.lyric || '',
              audio_url: permanentAudioUrl,
              image_url: track.image_large_url || track.image_url || null,
              is_public: false,
              genre: cleanStyle || null,
              metadata: JSON.stringify({ source: 'pro-music', model: model || DEFAULT_MODEL, language, engine: '444-pro', duration: track.duration, trackNumber: 1 }),
            }),
          })
          if (cmRes.ok) {
            const d = await cmRes.json()
            savedCombined = Array.isArray(d) ? d[0] : d
          }
        } catch (e) {
          console.error('❌ combined_media save error (Track 1):', e)
        }

        // Save Track 2 to combined_media (if available)
        if (permanentAudioUrl2) {
          try {
            await fetch(`${supabaseUrl}/rest/v1/combined_media`, {
              method: 'POST',
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: userId,
                type: 'audio',
                title: `${cleanTitle} (Take 2)`,
                audio_prompt: cleanPrompt,
                lyrics: cleanLyrics || track2?.lyric || '',
                audio_url: permanentAudioUrl2,
                image_url: track2?.image_large_url || track2?.image_url || null,
                is_public: false,
                genre: cleanStyle || null,
                metadata: JSON.stringify({ source: 'pro-music', model: model || DEFAULT_MODEL, language, engine: '444-pro', duration: track2?.duration, trackNumber: 2 }),
              }),
            })
          } catch (e) {
            console.error('❌ combined_media save error (Track 2):', e)
          }
        }

        const libraryId = savedMusic?.id || savedCombined?.id || null

        // Quest tracking
        try {
          const { trackQuestProgress, trackModelUsage, trackGenerationStreak } = await import('@/lib/quest-progress')
          trackQuestProgress(userId, 'generate_songs').catch(() => {})
          if (cleanStyle) trackQuestProgress(userId, 'use_genres', 1, cleanStyle).catch(() => {})
          trackModelUsage(userId, '444-pro').catch(() => {})
          trackGenerationStreak(userId).catch(() => {})
        } catch {}

        updateTransactionMedia({ userId, type: 'generation_music', mediaUrl: permanentAudioUrl, mediaType: 'audio', title: cleanTitle, extraMeta: { genre: cleanStyle, model: model || DEFAULT_MODEL, engine: '444-pro' } }).catch(() => {})
        notifyGenerationComplete(userId, libraryId || '', 'music', cleanTitle).catch(() => {})
        notifyCreditDeduct(userId, CREDIT_COST, `Pro Music: ${cleanTitle}`).catch(() => {})

        await sendLine({
          type: 'result',
          success: true,
          audioUrl: permanentAudioUrl,
          secondAudioUrl: permanentAudioUrl2,
          title: cleanTitle,
          secondTitle: permanentAudioUrl2 ? `${cleanTitle} (Take 2)` : null,
          lyrics: cleanLyrics || track.lyric || '',
          libraryId,
          secondLibraryId: savedMusic2?.id || null,
          creditsRemaining: deductResult!.new_credits,
          creditsDeducted: CREDIT_COST,
          trackCount: permanentAudioUrl2 ? 2 : 1,
        })
        await writer.close().catch(() => {})
      } catch (error) {
        console.error('❌ Pro music generation error:', error)
        await refundCredits({
          userId,
          amount: CREDIT_COST,
          type: 'generation_music',
          reason: `Pro gen error: ${String(error).substring(0, 80)}`,
          metadata: { prompt: cleanPrompt, language, error: String(error).substring(0, 200) },
        })
        notifyGenerationFailed(userId, 'music', 'Pro Music generation error — credits refunded').catch(() => {})
        try {
          await sendLine({ type: 'result', success: false, error: sanitizeSunoError(error) })
          await writer.close()
        } catch { /* stream closed */ }
      }
    })()

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('❌ Pro music route error:', error)
    return NextResponse.json({ success: false, error: sanitizeSunoError(error) }, { status: 500 })
  }
}
