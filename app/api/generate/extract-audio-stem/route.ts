import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { createClient } from '@supabase/supabase-js'

// Allow up to 5 minutes for stem extraction (large files can take time)
export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EXTRACT_COST = 1

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      audioUrl,
      stem = 'vocals',
      trackTitle = 'Extracted Audio',
      output_format = 'mp3',
      mp3_bitrate = 320,
      model_name = 'htdemucs_6s',
      shifts = 1,
      overlap = 0.25,
      clip_mode = 'rescale',
      float32 = false,
    } = body

    if (!audioUrl) {
      return NextResponse.json({ error: 'Audio URL is required' }, { status: 400 })
    }

    // Validate stem
    const validStems = ['vocals', 'bass', 'drums', 'piano', 'guitar', 'other']
    if (!validStems.includes(stem)) {
      return NextResponse.json({ error: `Invalid stem. Choose from: ${validStems.join(', ')}` }, { status: 400 })
    }

    console.log('🎵 Extract Audio Stem request')
    console.log('🎹 Stem:', stem)
    console.log('🔊 Audio URL:', audioUrl)
    console.log('💰 Credit cost:', EXTRACT_COST)

    // Try to find the parent track
    const { data: parentTrack } = await supabase
      .from('combined_media')
      .select('id, title, image_url')
      .eq('audio_url', audioUrl)
      .maybeSingle()

    // Check user credits
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (userData.credits < EXTRACT_COST) {
      return NextResponse.json({
        error: `Insufficient credits. Need ${EXTRACT_COST} credit but have ${userData.credits}`,
        creditsNeeded: EXTRACT_COST,
        creditsAvailable: userData.credits
      }, { status: 402 })
    }

    // ✅ DEDUCT credit atomically BEFORE generation (blocks if wallet < $1)
    const { data: deductResultRaw } = await supabase
      .rpc('deduct_credits', { p_clerk_user_id: userId, p_amount: EXTRACT_COST })
      .single()
    const deductResult = deductResultRaw as { success: boolean; new_credits: number; error_message?: string | null } | null
    if (!deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      console.error('❌ Credit deduction blocked:', errorMsg)
      await logCreditTransaction({ userId, amount: -EXTRACT_COST, type: 'generation_extract', status: 'failed', description: `Extract ${stem}: ${trackTitle}`, metadata: { stem } })
      return NextResponse.json({ error: errorMsg }, { status: 402 })
    }
    console.log(`✅ Credit deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId, amount: -EXTRACT_COST, balanceAfter: deductResult.new_credits, type: 'generation_extract', description: `Extract ${stem}: ${trackTitle}`, metadata: { stem } })

    // Stream response for progress updates
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    const sendLine = async (data: Record<string, unknown>) => {
      await writer.write(encoder.encode(JSON.stringify(data) + '\n'))
    }

    const requestSignal = request.signal

    ;(async () => {
      try {
        await sendLine({ type: 'progress', status: 'starting', stem, elapsed: 0 })

        // Use htdemucs_6s for guitar/piano support, htdemucs for 4-stem only
        const effectiveModel = (stem === 'guitar' || stem === 'piano') ? 'htdemucs_6s' : model_name

        // Create Replicate prediction using cjwbw/demucs
        const prediction = await replicate.predictions.create({
          version: "25a173108cff36ef9f80f854c162d01df9e6528be175794b81158fa03836d953",
          input: {
            audio: audioUrl,
            stem,
            shifts,
            float32,
            overlap,
            clip_mode,
            model_name: effectiveModel,
            mp3_bitrate,
            output_format,
          }
        })

        console.log('📡 Demucs prediction created:', prediction.id)
        await sendLine({ type: 'started', predictionId: prediction.id })

        // Poll for result — up to 3 minutes
        let finalPrediction = prediction
        let attempts = 0
        const MAX_POLL_ATTEMPTS = 36 // 36 × 5s = 180s max

        while (
          finalPrediction.status !== 'succeeded' &&
          finalPrediction.status !== 'failed' &&
          finalPrediction.status !== 'canceled' &&
          attempts < MAX_POLL_ATTEMPTS
        ) {
          if (requestSignal.aborted) {
            console.log('[Extract] Client disconnected, cancelling:', prediction.id)
            try { await replicate.predictions.cancel(prediction.id) } catch {}
            await logCreditTransaction({ userId, amount: 0, type: 'generation_extract', status: 'failed', description: `Extract ${stem} cancelled`, metadata: { reason: 'client_disconnected' } })
            await sendLine({ type: 'result', success: false, error: 'Extraction cancelled' }).catch(() => {})
            await writer.close().catch(() => {})
            return
          }

          await new Promise(resolve => setTimeout(resolve, 5000))
          finalPrediction = await replicate.predictions.get(prediction.id)
          attempts++
          await sendLine({ type: 'progress', status: finalPrediction.status, elapsed: attempts * 5 }).catch(() => {})
        }

        // Timeout check
        if (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && finalPrediction.status !== 'canceled') {
          console.log(`[Extract] ⏰ Timeout after ${attempts * 5}s, cancelling:`, prediction.id)
          try { await replicate.predictions.cancel(prediction.id) } catch {}
          await logCreditTransaction({ userId, amount: 0, type: 'generation_extract', status: 'failed', description: `Extract ${stem} timed out`, metadata: { reason: 'timeout', predictionId: prediction.id } })
          await sendLine({ type: 'result', success: false, error: 'Extraction timed out after 3 minutes. Please try again.' })
          await writer.close()
          return
        }

        if (finalPrediction.status !== 'succeeded') {
          const errMsg = finalPrediction.error || 'Extraction failed'
          await logCreditTransaction({ userId, amount: 0, type: 'generation_extract', status: 'failed', description: `Extract ${stem} failed`, metadata: { error: String(errMsg).substring(0, 200) } })
          await sendLine({ type: 'result', success: false, error: errMsg })
          await writer.close()
          return
        }

        // Demucs output is an object with stem names as keys
        const output = finalPrediction.output as Record<string, string | null>
        if (!output) {
          await sendLine({ type: 'result', success: false, error: 'No output from model' })
          await writer.close()
          return
        }

        console.log('✅ Demucs output:', JSON.stringify(output))

        // Collect non-null outputs (the requested stem + "other")
        const extractedStems: Record<string, string> = {}
        for (const [key, value] of Object.entries(output)) {
          if (typeof value === 'string' && value.startsWith('http')) {
            extractedStems[key] = value
          }
        }

        if (Object.keys(extractedStems).length === 0) {
          await sendLine({ type: 'result', success: false, error: 'No audio stems returned. Try a different audio file.' })
          await writer.close()
          return
        }

        // Download and upload each output to R2
        await sendLine({ type: 'progress', status: 'uploading', elapsed: attempts * 5 + 1 }).catch(() => {})
        const permanentStems: Record<string, string> = {}
        const savedLibraryIds: string[] = []
        const timestamp = Date.now()

        for (const [stemName, replicateUrl] of Object.entries(extractedStems)) {
          try {
            const dlRes = await fetch(replicateUrl)
            if (!dlRes.ok) {
              console.error(`[Extract] Failed to download ${stemName}:`, dlRes.status)
              permanentStems[stemName] = replicateUrl
              continue
            }
            const buffer = Buffer.from(await dlRes.arrayBuffer())
            const safeName = stemName.replace(/[^a-zA-Z0-9_-]/g, '-')
            const ext = output_format || 'mp3'
            const r2Key = `${userId}/extract/${timestamp}-${safeName}.${ext}`

            const r2Result = await uploadToR2(buffer, 'audio-files', r2Key, `audio/${ext === 'mp3' ? 'mpeg' : ext}`)
            if (r2Result.success && r2Result.url) {
              permanentStems[stemName] = r2Result.url
              console.log(`[Extract] ✅ ${stemName} → R2:`, r2Result.url)

              // Save to library
              const stemTitle = parentTrack?.title
                ? `${parentTrack.title} — ${stemName.charAt(0).toUpperCase() + stemName.slice(1)} Extract`
                : `${trackTitle} — ${stemName.charAt(0).toUpperCase() + stemName.slice(1)} Extract`

              const { data: saved, error: saveErr } = await supabase
                .from('combined_media')
                .insert({
                  user_id: userId,
                  type: 'audio',
                  title: stemTitle,
                  audio_url: r2Result.url,
                  image_url: parentTrack?.image_url || null,
                  is_public: false,
                  genre: 'extract',
                  stem_type: stemName.toLowerCase(),
                  parent_track_id: parentTrack?.id || null,
                  description: `${stemName} extracted from: ${parentTrack?.title || trackTitle}`,
                  metadata: JSON.stringify({
                    source: 'audio-to-audio',
                    requested_stem: stem,
                    model_name: effectiveModel,
                    output_format,
                    mp3_bitrate,
                  })
                })
                .select('id')
                .single()

              if (saved?.id) {
                savedLibraryIds.push(saved.id)
              } else if (saveErr) {
                console.error(`[Extract] Library save error for ${stemName}:`, saveErr.message)
              }
            } else {
              permanentStems[stemName] = replicateUrl
              console.error(`[Extract] R2 upload failed for ${stemName}`)
            }
          } catch (err) {
            console.error(`[Extract] Error persisting ${stemName}:`, err)
            permanentStems[stemName] = replicateUrl
          }
        }

        // Quest progress: fire-and-forget
        const { trackQuestProgress } = await import('@/lib/quest-progress')
        trackQuestProgress(userId, 'generate_songs').catch(() => {})

        await sendLine({
          type: 'result',
          success: true,
          stems: permanentStems,
          requestedStem: stem,
          libraryIds: savedLibraryIds,
          title: `${trackTitle} — ${stem.charAt(0).toUpperCase() + stem.slice(1)} Extract`,
          creditsUsed: EXTRACT_COST,
          creditsRemaining: deductResult.new_credits,
          extractType: 'audio-to-audio',
        })
        await writer.close()
      } catch (error) {
        console.error('[Extract] Stream error:', error)
        await logCreditTransaction({ userId, amount: 0, type: 'generation_extract', status: 'failed', description: `Extract failed`, metadata: { error: String(error).substring(0, 200) } })
        try {
          await sendLine({ type: 'result', success: false, error: '444 radio is locking in, please try again in few minutes' })
          await writer.close()
        } catch { /* stream may already be closed */ }
      }
    })()

    return new Response(stream.readable, {
      headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' }
    })
  } catch (error) {
    console.error('Extract audio error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to extract audio: ${errorMessage}` }, { status: 500 })
  }
}
