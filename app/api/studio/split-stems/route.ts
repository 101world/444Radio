/**
 * Split Stems API - Separates a song into stems using Replicate
 * Returns a set of stem URLs (e.g., vocals, drums, bass, other, instrumental)
 * The actual keys depend on the configured model's output schema.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { createClient } from '@supabase/supabase-js'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

type StemsMap = Record<string, string>

function normalizeStems(output: any): StemsMap | null {
  if (!output) return null
  // If already an object map of names -> urls
  if (typeof output === 'object' && !Array.isArray(output)) {
    const map: StemsMap = {}
    for (const [k, v] of Object.entries(output)) {
      if (typeof v === 'string') map[k] = v
      else if (v && typeof (v as any).url === 'string') map[k] = (v as any).url
      else if (v && (v as any).audio && typeof (v as any).audio.download_uri === 'string') map[k] = (v as any).audio.download_uri
    }
    return Object.keys(map).length ? map : null
  }
  // If array of strings or objects with url/audio
  if (Array.isArray(output)) {
    const map: StemsMap = {}
    let idx = 1
    for (const item of output) {
      if (typeof item === 'string') {
        map[`stem${idx++}`] = item
      } else if (item && typeof item === 'object') {
        if (typeof (item as any).url === 'string') map[`stem${idx++}`] = (item as any).url
        else if ((item as any).audio && typeof (item as any).audio.download_uri === 'string') map[`stem${idx++}`] = (item as any).audio.download_uri
      }
    }
    return Object.keys(map).length ? map : null
  }
  if (typeof output === 'string') return { stem1: output }
  return null
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    }

    const token = process.env.REPLICATE_API_KEY_LATEST
    if (!token) {
      console.error('❌ REPLICATE_API_KEY_LATEST is not set in environment variables')
      return corsResponse(NextResponse.json({ success: false, error: 'Missing REPLICATE_API_KEY_LATEST' }, { status: 500 }))
    }
    
    console.log('✅ Replicate API token found, length:', token.length)

    const body = await request.json().catch(() => null)
    const audioUrl = body?.audioUrl as string | undefined
    const outputFormat = (body?.outputFormat as string | undefined) || 'mp3' // Default to mp3
    
    if (!audioUrl || typeof audioUrl !== 'string') {
      return corsResponse(NextResponse.json({ success: false, error: 'audioUrl required' }, { status: 400 }))
    }
    
    if (!['mp3', 'wav'].includes(outputFormat)) {
      return corsResponse(NextResponse.json({ success: false, error: 'outputFormat must be mp3 or wav' }, { status: 400 }))
    }

    // Credits: stems generation costs 15 credits
    const CREDITS_COST = 15

    // Supabase client for credits check/deduct
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!supabaseUrl || !supabaseServiceKey) {
      return corsResponse(NextResponse.json({ success: false, error: 'Missing Supabase configuration' }, { status: 500 }))
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch user credits
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single()
    if (userError || !userData) {
      return corsResponse(NextResponse.json({ success: false, error: 'User not found' }, { status: 404 }))
    }
    const currentCredits = Number(userData.credits || 0)
    if (currentCredits < CREDITS_COST) {
      return corsResponse(NextResponse.json({ success: false, error: `Insufficient credits (need ${CREDITS_COST})` }, { status: 402 }))
    }
    // Deduct credits upfront
    const { error: deductError } = await supabase
      .from('users')
      .update({ credits: currentCredits - CREDITS_COST, updated_at: new Date().toISOString() })
      .eq('clerk_user_id', userId)
    if (deductError) {
      return corsResponse(NextResponse.json({ success: false, error: 'Credit deduction failed' }, { status: 500 }))
    }

    // Use cjwbw/demucs model - industry-standard stem separation
    const replicate = new Replicate({ auth: token })

    let prediction: any
    let lastError: any = null

    // Attempt prediction creation with retry+backoff for transient errors
    const MAX_ATTEMPTS = 3
    const BASE_DELAY_MS = 1000
    let attempt = 0
    const createPrediction = async () => {
      attempt++
      try {
        console.log('🎵 Starting stem separation (attempt', attempt, ')', { audioUrl, outputFormat })
        const resp = await replicate.predictions.create({
          version: '07afda7a710da69773c01f50d61e0f7f0c75e4c2f0c7b5fce4ae29e31c59b88c',
          input: {
            audio: audioUrl,
            output_format: outputFormat,
            stems: 'all',
          },
        })
        console.log('✅ Prediction created:', resp?.id)
        return resp
      } catch (e: any) {
        lastError = e
        const status = e?.response?.status
        console.error(`❌ Demucs stem separation error (attempt ${attempt}):`, {
          message: e?.message,
          status,
          statusText: e?.response?.statusText,
          data: e?.response?.data,
          stack: e?.stack,
        })

        // For 4xx errors (client), don't retry except for 429 (rate limit)
        if (status && status >= 400 && status < 500 && status !== 429) {
          throw e
        }

        if (attempt < MAX_ATTEMPTS) {
          const wait = BASE_DELAY_MS * Math.pow(2, attempt - 1)
          console.log(`⏳ Retrying in ${wait}ms...`)
          await new Promise((r) => setTimeout(r, wait))
          return createPrediction()
        }
        // else fall through to return undefined / throw
        throw e
      }
    }

    try {
      prediction = await createPrediction()
    } catch (e) {
      // Non-retryable error or repeated failures
      lastError = e
      console.error('❌ Demucs stem separation final error:', e)
    }

    if (!prediction) {
      // Refund on prediction creation failure
      await supabase.from('users').update({ credits: currentCredits }).eq('clerk_user_id', userId)
      const errorMsg = lastError?.message || lastError?.toString() || 'Unknown error'
      console.error('❌ Stem separation failed:', errorMsg)
      return corsResponse(NextResponse.json({ 
        success: false, 
        error: 'Stem separation is temporarily unavailable. This feature requires specific AI models that may be under maintenance.', 
        detail: errorMsg 
      }, { status: 503 }))
    }

    // Poll for completion up to 240s (extended for demucs processing time)
    const start = Date.now()
    const TIMEOUT_MS = 240000 // 4 minutes
    const POLL_INTERVAL_MS = 3000 // Poll every 3 seconds
    let result = prediction
    let pollAttempts = 0
    
    while (result && result.status && result.status !== 'succeeded' && result.status !== 'failed' && result.status !== 'canceled') {
      pollAttempts++
      const elapsed = Date.now() - start
      
      if (elapsed > TIMEOUT_MS) {
        console.error(`❌ Stem separation timeout after ${elapsed}ms, ${pollAttempts} poll attempts`)
        // Refund on timeout
        await supabase.from('users').update({ credits: currentCredits }).eq('clerk_user_id', userId)
        return corsResponse(NextResponse.json({ 
          success: false, 
          error: 'Stem separation timed out. The AI model may be experiencing high demand. Please try again in a few minutes.',
          predictionId: result.id
        }, { status: 408 }))
      }
      
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      
      try {
        result = await replicate.predictions.get(result.id)
        console.log(`🔄 Poll attempt ${pollAttempts}: status=${result.status}, elapsed=${Math.round(elapsed/1000)}s`)
      } catch (pollError: any) {
        console.error(`⚠️ Error polling prediction (attempt ${pollAttempts}):`, pollError?.message)
        // On poll error, retry with exponential backoff
        if (pollAttempts < 5) {
          await new Promise(r => setTimeout(r, POLL_INTERVAL_MS * 2))
          continue
        }
        // After 5 poll failures, give up and refund
        await supabase.from('users').update({ credits: currentCredits }).eq('clerk_user_id', userId)
        return corsResponse(NextResponse.json({ 
          success: false, 
          error: 'Unable to check stem separation status. Please try again.',
          detail: pollError?.message
        }, { status: 503 }))
      }
    }

    if (result.status === 'failed') {
      console.error('❌ Demucs prediction failed:', result.error)
      // Refund on failure
      await supabase.from('users').update({ credits: currentCredits }).eq('clerk_user_id', userId)
      return corsResponse(NextResponse.json({ 
        success: false, 
        error: `Stem separation failed: ${result.error || 'Unknown error from AI model'}`,
        predictionId: result.id
      }, { status: 500 }))
    }
    
    if (result.status === 'canceled') {
      console.error('❌ Demucs prediction canceled')
      await supabase.from('users').update({ credits: currentCredits }).eq('clerk_user_id', userId)
      return corsResponse(NextResponse.json({ 
        success: false, 
        error: 'Stem separation was canceled',
        predictionId: result.id
      }, { status: 500 }))
    }

    const stems = normalizeStems(result.output)
    if (!stems || Object.keys(stems).length === 0) {
      console.error('❌ No stems in output:', result.output)
      // Refund on no output
      await supabase.from('users').update({ credits: currentCredits }).eq('clerk_user_id', userId)
      return corsResponse(NextResponse.json({ 
        success: false, 
        error: 'AI model returned no stems. This may be due to audio format or quality issues.',
        raw: result.output,
        predictionId: result.id
      }, { status: 502 }))
    }

    console.log(`✅ Stem separation complete: ${Object.keys(stems).length} stems extracted`)
    // Do not upload stems to R2 here; return direct URLs for immediate placement
    const remainingCredits = currentCredits - CREDITS_COST
    return corsResponse(NextResponse.json({ success: true, stems, predictionId: result.id, remainingCredits }))
  } catch (error: any) {
    console.error('❌ Split-stems critical error:', {
      message: error?.message,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      stack: error?.stack
    })
    
    // Provide helpful error messages based on status code
    let userMessage = 'An error occurred during stem separation. Please try again.'
    const status = error?.response?.status
    
    if (status === 402) {
      userMessage = 'Unable to process: Replicate billing issue. Please contact support.'
    } else if (status === 503 || status === 504) {
      userMessage = 'The AI service is temporarily unavailable due to high demand. Please try again in a few minutes.'
    } else if (status === 429) {
      userMessage = 'Rate limit exceeded. Please wait a moment and try again.'
    } else if (status >= 500) {
      userMessage = 'The AI service encountered an error. Please try again.'
    }
    
    return corsResponse(NextResponse.json({ 
      success: false, 
      error: userMessage,
      detail: error instanceof Error ? error.message : String(error),
      statusCode: status
    }, { status: status || 500 }))
  }
}
