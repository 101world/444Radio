// POST /api/media/wav-upload
// Accepts a WAV blob + original audioUrl, uploads WAV to R2, caches in wav_cache table.
// Body: multipart form with "wav" file + "audioUrl" (the original MP3 R2 URL)
// Auth: requires Clerk userId
//
// GET /api/media/wav-upload?audioUrl=... → check if cached WAV exists

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { uploadToR2 } from '@/lib/r2-upload'
import { corsResponse, handleOptions } from '@/lib/cors'
import crypto from 'crypto'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const formData = await req.formData()
    const wavFile = formData.get('wav') as File | null
    const audioUrl = formData.get('audioUrl') as string | null

    if (!wavFile || !audioUrl) {
      return corsResponse(NextResponse.json(
        { error: 'Missing wav file or audioUrl' },
        { status: 400 }
      ))
    }

    // Validate it's actually audio
    if (!wavFile.type.includes('audio') && !wavFile.type.includes('octet-stream')) {
      return corsResponse(NextResponse.json(
        { error: 'Invalid file type — must be audio/wav' },
        { status: 400 }
      ))
    }

    // Cap at 100MB
    if (wavFile.size > 100 * 1024 * 1024) {
      return corsResponse(NextResponse.json(
        { error: 'WAV file too large (max 100MB)' },
        { status: 400 }
      ))
    }

    // Check if already cached (race condition guard)
    const { data: existing } = await supabase
      .from('wav_cache')
      .select('wav_url')
      .eq('audio_url', audioUrl)
      .single()

    if (existing?.wav_url) {
      return corsResponse(NextResponse.json({ wav_url: existing.wav_url }))
    }

    // Upload WAV to R2
    const key = `wav/${crypto.randomUUID()}.wav`
    const arrayBuffer = await wavFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const result = await uploadToR2(buffer, 'audio-files', key, 'audio/wav')

    if (!result.success || !result.url) {
      console.error('WAV R2 upload failed:', result.error)
      return corsResponse(NextResponse.json(
        { error: 'Failed to upload WAV to storage' },
        { status: 500 }
      ))
    }

    // Save to wav_cache
    const { error: insertErr } = await supabase
      .from('wav_cache')
      .upsert({
        audio_url: audioUrl,
        wav_url: result.url,
        created_by: userId,
        file_size: wavFile.size,
      }, { onConflict: 'audio_url' })

    if (insertErr) {
      console.error('Failed to save wav_cache:', insertErr)
      // WAV is uploaded to R2, just cache save failed — still return the URL
    }

    // Also update combined_media.wav_url if this audio exists there
    await supabase
      .from('combined_media')
      .update({ wav_url: result.url })
      .eq('audio_url', audioUrl)

    console.log(`✅ WAV cached: ${audioUrl} → ${result.url} (${(wavFile.size / 1024 / 1024).toFixed(1)}MB)`)
    return corsResponse(NextResponse.json({ wav_url: result.url }))

  } catch (error) {
    console.error('wav-upload error:', error)
    return corsResponse(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ))
  }
}

// GET: check if a cached WAV exists for an audioUrl
// Supports both ?audioUrl= query param and POST JSON { audioUrl } via PUT method
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const audioUrl = req.nextUrl.searchParams.get('audioUrl')
    if (!audioUrl) {
      return corsResponse(NextResponse.json({ error: 'Missing audioUrl' }, { status: 400 }))
    }

    const { data } = await supabase
      .from('wav_cache')
      .select('wav_url')
      .eq('audio_url', audioUrl)
      .single()

    return corsResponse(NextResponse.json({ wav_url: data?.wav_url || null }))
  } catch {
    return corsResponse(NextResponse.json({ wav_url: null }))
  }
}

// PUT: check cache via JSON body (avoids URL length limits on Vercel)
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const audioUrl = body.audioUrl
    if (!audioUrl) {
      return corsResponse(NextResponse.json({ error: 'Missing audioUrl' }, { status: 400 }))
    }

    const { data } = await supabase
      .from('wav_cache')
      .select('wav_url')
      .eq('audio_url', audioUrl)
      .single()

    return corsResponse(NextResponse.json({ wav_url: data?.wav_url || null }))
  } catch {
    return corsResponse(NextResponse.json({ wav_url: null }))
  }
}
