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

    // Temporarily disabled while we configure the correct Replicate model
    return corsResponse(NextResponse.json({ 
      success: false, 
      error: 'Stem separation is temporarily unavailable while we upgrade to a better AI model. Please check back soon!',
      temporary: true
    }, { status: 503 }))

    /* COMMENTED OUT UNTIL MODEL IS CONFIGURED
    const token = process.env.REPLICATE_API_TOKEN
    if (!token) {
      return corsResponse(NextResponse.json({ success: false, error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 }))
    }

    const body = await request.json().catch(() => null)
    const audioUrl = body?.audioUrl as string | undefined
    if (!audioUrl || typeof audioUrl !== 'string') {
      return corsResponse(NextResponse.json({ success: false, error: 'audioUrl required' }, { status: 400 }))
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

    // Use a working stems separation model
    // The cjwbw/deezer-spleeter model is reliable and well-tested
    const replicate = new Replicate({ auth: token })

    let prediction: any
    let lastError: any = null

    try {
      // Using Spleeter model which is proven to work
      prediction = await replicate.predictions.create({
        version: "583a48f40b19c2a3af4a7f3e7f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f",
        input: {
          audio: audioUrl,
          stems: "5" // 5 stems: vocals, drums, bass, piano, other
        }
      })
    } catch (e: any) {
      lastError = e
      console.error('Stem separation model error:', e)
      
      // Try without specific stems parameter
      try {
        prediction = await replicate.predictions.create({
          version: "583a48f40b19c2a3af4a7f3e7f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f",
          input: {
            audio: audioUrl
          }
        })
      } catch (e2: any) {
        lastError = e2
        console.error('Fallback stem separation failed:', e2)
      }
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

    // Poll for completion up to 180s
    const start = Date.now()
    let result = prediction
    while (result && result.status && result.status !== 'succeeded' && result.status !== 'failed') {
      if (Date.now() - start > 180000) {
        // Refund on timeout
        await supabase.from('users').update({ credits: currentCredits }).eq('clerk_user_id', userId)
        return corsResponse(NextResponse.json({ success: false, error: 'Stems splitting timeout' }, { status: 408 }))
      }
      await new Promise(r => setTimeout(r, 2000))
      result = await replicate.predictions.get(result.id)
    }

    if (result.status === 'failed') {
      // Refund on failure
      await supabase.from('users').update({ credits: currentCredits }).eq('clerk_user_id', userId)
      return corsResponse(NextResponse.json({ success: false, error: result.error || 'Stem splitting failed' }, { status: 500 }))
    }

    const stems = normalizeStems(result.output)
    if (!stems || Object.keys(stems).length === 0) {
      // Refund on no output
      await supabase.from('users').update({ credits: currentCredits }).eq('clerk_user_id', userId)
      return corsResponse(NextResponse.json({ success: false, error: 'No stems returned', raw: result.output }, { status: 502 }))
    }

    // Do not upload stems to R2 here; return direct URLs for immediate placement
    const remainingCredits = currentCredits - CREDITS_COST
    return corsResponse(NextResponse.json({ success: true, stems, predictionId: result.id, remainingCredits }))
    */
  } catch (error) {
    console.error('❌ Split-stems error:', error)
    return corsResponse(NextResponse.json({ 
      success: false, 
      error: 'Stem separation feature is temporarily unavailable',
      temporary: true 
    }, { status: 503 }))
  }
}
