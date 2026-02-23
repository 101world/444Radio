import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * GET /api/library/remix
 * Get user's remix generations from music_library (model = meta/musicgen)
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch remixes: rows in music_library where generation_params->model = 'meta/musicgen'
    const res = await fetch(
      `${supabaseUrl}/rest/v1/music_library?clerk_user_id=eq.${userId}&generation_params-%3E%3Emodel=eq.meta/musicgen&order=created_at.desc&limit=200`,
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
      duration: item.generation_params?.duration,
      model_version: item.generation_params?.model_version,
      plays: item.plays || 0,
      created_at: item.created_at,
    }))

    return NextResponse.json({ success: true, remixes })
  } catch (error) {
    console.error('Error fetching remixes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
