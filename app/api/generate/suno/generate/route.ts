import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { refundCredits } from '@/lib/refund-credits'
import { notifyGenerationComplete, notifyGenerationFailed, notifyCreditDeduct } from '@/lib/notifications'
import { generateMusic, pollTaskUntilDone, sanitizeSunoError, SUNO_CREDIT_COSTS, type SunoModel } from '@/lib/suno-api'

export const maxDuration = 300

const CREDIT_COST = SUNO_CREDIT_COSTS.generate // 5 credits
const DEFAULT_MODEL: SunoModel = 'V5'

/**
 * POST /api/generate/suno/generate
 *
 * 444 Pro Music — Hindi / Urdu / Arabic / Tamil / Telugu / Punjabi generation
 * via Suno API. Returns NDJSON stream. Costs 5 credits per generation (2 tracks).
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

        // Build generation params
        // V5 requires a non-empty callBackUrl even when polling
        const sunoParams: Record<string, unknown> = {
          customMode: isCustomMode,
          instrumental,
          model: model || DEFAULT_MODEL,
          callBackUrl: 'https://www.444radio.co.in/api/webhook/generation-callback',
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

        // V5 may return tracks at different paths — check all known shapes
        console.log('🎵 [444-PRO] Raw poll response:', JSON.stringify(completed).substring(0, 1000))

        const extractTracks = (data: any): any[] => {
          return data?.response?.data
            || data?.response?.sunoData
            || data?.sunoData
            || (Array.isArray(data?.response) ? data.response : null)
            || []
        }

        let tracks = extractTracks(completed.data)

        // V5 with callBackUrl may deliver tracks via callback instead of poll response.
        // If SUCCESS but empty tracks, retry polling a few times then check callback data.
        if (!tracks.length) {
          console.log('⏳ [444-PRO] SUCCESS but no tracks yet — retrying poll...')
          for (let retry = 0; retry < 4; retry++) {
            await new Promise(r => setTimeout(r, 10_000)) // wait 10s between retries
            try {
              const retryStatus = await import('@/lib/suno-api').then(m => m.getTaskStatus(taskId))
              console.log(`🔄 [444-PRO] Retry ${retry + 1}:`, JSON.stringify(retryStatus).substring(0, 500))
              tracks = extractTracks(retryStatus.data)
              if (tracks.length) {
                console.log(`✅ [444-PRO] Got ${tracks.length} tracks on retry ${retry + 1}`)
                break
              }
            } catch (e) {
              console.warn(`⚠️ [444-PRO] Retry ${retry + 1} failed:`, e)
            }
          }
        }

        // Fallback: check if callback endpoint stored the data
        if (!tracks.length) {
          console.log('🔔 [444-PRO] Checking callback data...')
          try {
            const cbRes = await fetch(
              `${supabaseUrl}/rest/v1/generation_callbacks?task_id=eq.${taskId}&select=payload&limit=1`,
              { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
            )
            if (cbRes.ok) {
              const cbRows = await cbRes.json()
              if (cbRows?.[0]?.payload) {
                const cbPayload = cbRows[0].payload
                console.log('🔔 [444-PRO] Callback payload found:', JSON.stringify(cbPayload).substring(0, 500))
                tracks = extractTracks(cbPayload)
                  || extractTracks(cbPayload?.data)
                  || cbPayload?.data?.response?.data
                  || []
              }
            }
          } catch (e) {
            console.warn('⚠️ [444-PRO] Callback lookup failed:', e)
          }
        }

        if (!tracks.length) {
          console.error('❌ [444-PRO] No tracks found after retries + callback. Full response:', JSON.stringify(completed))
          throw new Error('No tracks returned from generation')
        }

        // Helper: extract audio URL from a track object (V4/V5 compatible)
        const getTrackAudioUrl = (t: any) => t?.audio_url || t?.audioUrl || t?.stream_audio_url || t?.streamAudioUrl || t?.song_url || t?.songUrl || t?.url || t?.mp3_url || t?.output

        let track = tracks[0]
        console.log('🎵 [444-PRO] Track 1 keys:', JSON.stringify(Object.keys(track)))
        console.log('🎵 [444-PRO] Track 1 data:', JSON.stringify(track).substring(0, 800))

        // V5 may return track metadata before audio is ready — retry if no audio URL
        let audioSourceUrl = getTrackAudioUrl(track)
        if (!audioSourceUrl) {
          console.log('⏳ [444-PRO] Tracks found but no audio URL yet — waiting for audio processing...')
          await sendLine({ type: 'progress', message: 'Audio is processing...' })
          for (let audioRetry = 0; audioRetry < 6; audioRetry++) {
            await new Promise(r => setTimeout(r, 15_000)) // wait 15s
            try {
              const retryStatus = await import('@/lib/suno-api').then(m => m.getTaskStatus(taskId))
              const retryTracks = extractTracks(retryStatus.data)
              if (retryTracks.length) {
                track = retryTracks[0]
                audioSourceUrl = getTrackAudioUrl(track)
                console.log(`🔄 [444-PRO] Audio retry ${audioRetry + 1}: url=${audioSourceUrl ? 'found' : 'still missing'}`)
                if (audioSourceUrl) {
                  // Update tracks array for Track 2 extraction later
                  tracks.splice(0, tracks.length, ...retryTracks)
                  break
                }
              }
            } catch (e) {
              console.warn(`⚠️ [444-PRO] Audio retry ${audioRetry + 1} error:`, e)
            }
          }
        }

        if (!audioSourceUrl) {
          console.error('❌ [444-PRO] No audio URL after retries. Full track:', JSON.stringify(track))
          throw new Error('No audio URL in generated track')
        }

        const trackTitle = track.title || track.name || cleanTitle
        const trackDuration = track.duration || track.audio_duration || 0
        const trackLyric = track.lyric || track.lyrics || ''
        const trackImageUrl = track.image_large_url || track.image_url || track.imageUrl || track.cover_url || null

        console.log('🎵 [444-PRO] Track 1 ready:', trackTitle, 'Duration:', trackDuration)

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
        const track2AudioUrl = getTrackAudioUrl(track2)
        if (track2AudioUrl) {
          const track2Title = track2?.title || track2?.name || `${cleanTitle} (Take 2)`
          const track2Duration = track2?.duration || track2?.audio_duration || 0
          console.log('🎵 [444-PRO] Track 2 ready:', track2Title, 'Duration:', track2Duration)
          const fileName2 = `pro-${cleanTitle.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-2-${Date.now()}.wav`
          const r2Result2 = await downloadAndUploadToR2(track2AudioUrl, userId, 'music', fileName2)
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
          lyrics: cleanLyrics || trackLyric || '',
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
            lyrics: cleanLyrics || track2?.lyric || track2?.lyrics || '',
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
              lyrics: cleanLyrics || trackLyric || '',
              audio_url: permanentAudioUrl,
              image_url: trackImageUrl,
              is_public: false,
              genre: cleanStyle || null,
              metadata: JSON.stringify({ source: 'pro-music', model: model || DEFAULT_MODEL, language, engine: '444-pro', duration: trackDuration, trackNumber: 1 }),
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
                lyrics: cleanLyrics || track2?.lyric || track2?.lyrics || '',
                audio_url: permanentAudioUrl2,
                image_url: track2?.image_large_url || track2?.image_url || track2?.imageUrl || track2?.cover_url || null,
                is_public: false,
                genre: cleanStyle || null,
                metadata: JSON.stringify({ source: 'pro-music', model: model || DEFAULT_MODEL, language, engine: '444-pro', duration: track2?.duration || track2?.audio_duration, trackNumber: 2 }),
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
        const sanitizedReason = sanitizeSunoError(error)
        await refundCredits({
          userId,
          amount: CREDIT_COST,
          type: 'generation_music',
          reason: `Pro gen error: ${sanitizedReason}`,
          metadata: { prompt: cleanPrompt, language, error: sanitizedReason },
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
