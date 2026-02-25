import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * GET /api/library/remix
 * Get user's remix generations from music_library
 * Matches both legacy meta/musicgen AND new fal-ai/stable-audio-25/audio-to-audio
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch remixes: rows in music_library where generation_params->model matches remix models
    // Use or() to match both old and new model identifiers
    const res = await fetch(
      `${supabaseUrl}/rest/v1/music_library?clerk_user_id=eq.${userId}&or=(generation_params-%3E%3Emodel.eq.meta/musicgen,generation_params-%3E%3Emodel.eq.fal-ai/stable-audio-25/audio-to-audio,generation_params-%3E%3Emodel.eq.fal-stable-audio-25)&order=created_at.desc&limit=200`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )

    if (!res.ok) {
      console.error('Supabase error fetching remixes:', res.status)
      return NextResponse.json({ error: 'Failed to fetch remixes' }, { status: 500 })
    }

    const data = await res.json()

    const remixes = (data || []).map((item: any) => ({
      id: item.id,
      title: item.title || 'Untitled Remix',
      audioUrl: item.audio_url,
      prompt: item.prompt,
      audio_format: item.audio_format || 'wav',
      duration: item.generation_params?.duration || item.generation_params?.total_seconds,
      model: item.generation_params?.model,
      strength: item.generation_params?.strength,
      seed: item.generation_params?.seed,
      input_audio_url: item.generation_params?.input_audio_url,
      plays: item.plays || 0,
      created_at: item.created_at,
    }))

    return NextResponse.json({ success: true, remixes })
  } catch (error) {
    console.error('Error fetching remixes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
