import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { createClient } from '@supabase/supabase-js'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { uploadToR2 } from '@/lib/r2-upload'

export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const STEM_SPLIT_COST = 5

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { audioUrl } = await request.json()
    if (!audioUrl) {
      return NextResponse.json({ error: 'Audio URL required' }, { status: 400 })
    }

    // Try to find the parent track in combined_media by audio_url
    const { data: parentTrack } = await supabase
      .from('combined_media')
      .select('id, title, image_url')
      .eq('audio_url', audioUrl)
      .maybeSingle()

    // Check credits
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (userData.credits < STEM_SPLIT_COST) {
      return NextResponse.json({ 
        error: `Insufficient credits. Need ${STEM_SPLIT_COST} credits but have ${userData.credits}` 
      }, { status: 402 })
    }

    // Stream prediction ID to client for cancellation, then process result
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    const sendLine = async (data: Record<string, unknown>) => {
      await writer.write(encoder.encode(JSON.stringify(data) + '\n'))
    }

    // Capture request signal for client disconnect detection
    const requestSignal = request.signal

    // Return streaming response IMMEDIATELY — do all slow work inside the IIFE
    // This prevents Vercel 504 from slow Replicate cold-starts
    ;(async () => {
      try {
        // Send initial heartbeat so client knows the stream is alive
        await sendLine({ type: 'progress', status: 'starting', elapsed: 0 })

        // Create Replicate prediction (can take 5-30s on cold start)
        const prediction = await replicate.predictions.create({
          version: "f2a8516c9084ef460592deaa397acd4a97f60f18c3d15d273644c72500cdff0e",
          input: {
            music_input: audioUrl,
            model: "harmonix-all",
            sonify: false,
            visualize: false,
            audioSeparator: true,
            include_embeddings: false,
            audioSeparatorModel: "Kim_Vocal_2.onnx",
            include_activations: false
          }
        })

        await sendLine({ type: 'started', predictionId: prediction.id })

        // Poll for result — 60s hard timeout, cancel prediction if exceeded
        let finalPrediction = prediction
        let attempts = 0
        const MAX_POLL_ATTEMPTS = 12 // 12 × 5s = 60s max
        while (
          finalPrediction.status !== 'succeeded' &&
          finalPrediction.status !== 'failed' &&
          finalPrediction.status !== 'canceled' &&
          attempts < MAX_POLL_ATTEMPTS
        ) {
          if (requestSignal.aborted) {
            console.log('[Stem Split] Client disconnected, cancelling:', prediction.id)
            try { await replicate.predictions.cancel(prediction.id) } catch {}
            await logCreditTransaction({ userId, amount: 0, type: 'generation_stem_split', status: 'failed', description: 'Stem split cancelled', metadata: { reason: 'client_disconnected' } })
            await sendLine({ type: 'result', success: false, error: 'Stem split cancelled' }).catch(() => {})
            await writer.close().catch(() => {})
            return
          }
          await new Promise(resolve => setTimeout(resolve, 5000))
          finalPrediction = await replicate.predictions.get(prediction.id)
          attempts++
          // Heartbeat every poll to prevent Vercel 504 gateway timeout
          await sendLine({ type: 'progress', status: finalPrediction.status, elapsed: attempts * 5 }).catch(() => {})
        }

        // If timed out (still processing after 60s), cancel the prediction to stop billing
        if (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && finalPrediction.status !== 'canceled') {
          console.log(`[Stem Split] ⏰ Timeout after ${attempts * 5}s, cancelling prediction:`, prediction.id)
          try { await replicate.predictions.cancel(prediction.id) } catch (cancelErr) {
            console.error('[Stem Split] Failed to cancel prediction:', cancelErr)
          }
          await logCreditTransaction({ userId, amount: 0, type: 'generation_stem_split', status: 'failed', description: 'Stem split timed out (60s limit)', metadata: { reason: 'timeout', predictionId: prediction.id } })
          await sendLine({ type: 'result', success: false, error: 'Stem splitting timed out after 60 seconds. The model may be overloaded — please try again later.' })
          await writer.close()
          return
        }

        if (finalPrediction.status === 'canceled') {
          await sendLine({ type: 'result', success: false, error: 'Stem split cancelled' })
          await writer.close()
          return
        }

        if (finalPrediction.status !== 'succeeded') {
          await sendLine({ type: 'result', success: false, error: 'Stem split failed or timed out' })
          await writer.close()
          return
        }

        const raw = finalPrediction.output ?? finalPrediction

        // Simple: grab every key that has an audio URL, skip nulls/json/non-strings
        const stems: Record<string, string> = {}
        for (const [key, value] of Object.entries(raw || {})) {
          if (typeof value === 'string' && value.startsWith('http') && !value.includes('.json')) {
            let name = key.replace(/^(demucs_|mdx_)/, '')
            if (stems[name]) {
              name = `${name} 2`
            }
            stems[name] = value
          }
        }

        if (Object.keys(stems).length === 0) {
          await sendLine({ type: 'result', success: false, error: 'No stems returned. Try a different audio file.' })
          await writer.close()
          return
        }

        // Download each stem from Replicate and upload to R2 for permanent storage
        await sendLine({ type: 'progress', status: 'uploading', elapsed: attempts * 5 + 1 }).catch(() => {})
        const permanentStems: Record<string, string> = {}
        const savedLibraryIds: string[] = []
        const timestamp = Date.now()

        for (const [stemName, replicateUrl] of Object.entries(stems)) {
          try {
            const dlRes = await fetch(replicateUrl)
            if (!dlRes.ok) {
              console.error(`[Stem Split] Failed to download ${stemName}:`, dlRes.status)
              permanentStems[stemName] = replicateUrl // fallback to temp URL
              continue
            }
            const buffer = Buffer.from(await dlRes.arrayBuffer())
            const safeName = stemName.replace(/[^a-zA-Z0-9_-]/g, '-')
            const r2Key = `${userId}/stems/${timestamp}-${safeName}.mp3`

            const r2Result = await uploadToR2(buffer, 'audio-files', r2Key, 'audio/mpeg')
            if (r2Result.success && r2Result.url) {
              permanentStems[stemName] = r2Result.url
              console.log(`[Stem Split] ✅ ${stemName} → R2:`, r2Result.url)

              // Save to combined_media so it appears in library
              const stemTitle = parentTrack?.title 
                ? `${parentTrack.title} — ${stemName.charAt(0).toUpperCase() + stemName.slice(1)}`
                : `${stemName.charAt(0).toUpperCase() + stemName.slice(1)} (Stem)`
              const { data: saved, error: saveErr } = await supabase
                .from('combined_media')
                .insert({
                  user_id: userId,
                  type: 'audio',
                  title: stemTitle,
                  audio_url: r2Result.url,
                  image_url: parentTrack?.image_url || null,
                  is_public: false,
                  genre: 'stem',
                  stem_type: stemName.toLowerCase().replace(/\s+\d+$/, ''),
                  parent_track_id: parentTrack?.id || null,
                  description: `Stem split from: ${parentTrack?.title || audioUrl}`,
                })
                .select('id')
                .single()

              if (saved?.id) {
                savedLibraryIds.push(saved.id)
              } else if (saveErr) {
                console.error(`[Stem Split] Library save error for ${stemName}:`, saveErr.message)
              }
            } else {
              permanentStems[stemName] = replicateUrl // fallback
              console.error(`[Stem Split] R2 upload failed for ${stemName}`)
            }
          } catch (err) {
            console.error(`[Stem Split] Error persisting ${stemName}:`, err)
            permanentStems[stemName] = replicateUrl // fallback
          }
        }

        // Deduct credits after success
        const { data: deductResultRaw } = await supabase
          .rpc('deduct_credits', { p_clerk_user_id: userId, p_amount: STEM_SPLIT_COST })
          .single()

        const deductResult = deductResultRaw as { success: boolean; new_credits: number } | null

        await logCreditTransaction({ userId, amount: -STEM_SPLIT_COST, balanceAfter: deductResult?.new_credits ?? (userData.credits - STEM_SPLIT_COST), type: 'generation_stem_split', description: `Stem split (${Object.keys(permanentStems).join(', ')})`, metadata: { stems: Object.keys(permanentStems), libraryIds: savedLibraryIds } })

        await sendLine({
          type: 'result',
          success: true,
          stems: permanentStems,
          libraryIds: savedLibraryIds,
          creditsUsed: STEM_SPLIT_COST,
          creditsRemaining: deductResult?.new_credits ?? (userData.credits - STEM_SPLIT_COST)
        })
        await writer.close()
      } catch (error) {
        console.error('[Stem Split] Stream error:', error)
        await logCreditTransaction({ userId, amount: 0, type: 'generation_stem_split', status: 'failed', description: `Stem split failed`, metadata: { error: String(error).substring(0, 200) } })
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
    console.error('[Stem Split] Error:', error)
    return NextResponse.json({ 
      error: '444 radio is locking in, please try again in few minutes'
    }, { status: 500 })
  }
}
