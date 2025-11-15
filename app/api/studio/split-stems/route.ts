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

    // Model selection via env for flexibility
    const version = process.env.REPLICATE_STEMS_VERSION
    let model = process.env.REPLICATE_STEMS_MODEL

    // Fallback: Attempt a common stems model if not configured
    // NOTE: If you prefer a different model/version, set REPLICATE_STEMS_VERSION or REPLICATE_STEMS_MODEL
    const fallbackModel = 'facebook/demucs'
    if (!version && !model) {
      model = fallbackModel
    }

    const replicate = new Replicate({ auth: token })

    // Some models expect "audio" or "audio_url"; send both to be safe
    const input: Record<string, any> = { audio: audioUrl, audio_url: audioUrl }

    let prediction: any
    let lastError: any

    // Prefer version if provided
    if (version) {
      try {
        prediction = await replicate.predictions.create({ version, input })
      } catch (e) {
        lastError = e
      }
    }

    // Fallback to model slug
    if (!prediction && model) {
      try {
        prediction = await replicate.predictions.create({ model, input })
      } catch (e) {
        lastError = e
      }
    }

    if (!prediction) {
      // Refund on prediction creation failure
      await supabase.from('users').update({ credits: currentCredits }).eq('clerk_user_id', userId)
      return corsResponse(NextResponse.json({ success: false, error: 'Failed to create Replicate prediction', detail: String(lastError || '') }, { status: 502 }))
    }

    // Poll for completion up to 180s
    const start = Date.now()
    let result = prediction
    while (result.status !== 'succeeded' && result.status !== 'failed') {
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
  } catch (error) {
    console.error('❌ Split-stems error:', error)
    return corsResponse(NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Split-stems failed' }, { status: 500 }))
  }
}
