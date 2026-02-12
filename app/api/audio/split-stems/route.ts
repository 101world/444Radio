import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { createClient } from '@supabase/supabase-js'

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

    // Send prediction ID immediately
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

    // Process in background IIFE
    ;(async () => {
      try {
        // Poll for result — also check if client disconnected
        let finalPrediction = prediction
        let attempts = 0
        while (
          finalPrediction.status !== 'succeeded' &&
          finalPrediction.status !== 'failed' &&
          finalPrediction.status !== 'canceled' &&
          attempts < 60 // 5min at 5s intervals
        ) {
          if (requestSignal.aborted) {
            console.log('[Stem Split] Client disconnected, cancelling:', prediction.id)
            try { await replicate.predictions.cancel(prediction.id) } catch {}
            await sendLine({ type: 'result', success: false, error: 'Stem split cancelled' }).catch(() => {})
            await writer.close().catch(() => {})
            return
          }
          await new Promise(resolve => setTimeout(resolve, 5000))
          finalPrediction = await replicate.predictions.get(prediction.id)
          attempts++
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

        // Deduct credits after success
        const { data: deductResultRaw } = await supabase
          .rpc('deduct_credits', { p_clerk_user_id: userId, p_amount: STEM_SPLIT_COST })
          .single()

        const deductResult = deductResultRaw as { success: boolean; new_credits: number } | null

        await sendLine({
          type: 'result',
          success: true,
          stems,
          creditsUsed: STEM_SPLIT_COST,
          creditsRemaining: deductResult?.new_credits ?? (userData.credits - STEM_SPLIT_COST)
        })
        await writer.close()
      } catch (error) {
        console.error('[Stem Split] Stream error:', error)
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
