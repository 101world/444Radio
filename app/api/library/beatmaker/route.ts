import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * GET /api/library/beatmaker
 * Get user's beat maker generations from music_library
 * Matches rows where generation_params->model = cassetteai-music-generator
 * OR genre = 'beatmaker'
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/music_library?clerk_user_id=eq.${userId}&or=(generation_params-%3E%3Emodel.eq.cassetteai-music-generator,genre.eq.beatmaker)&order=created_at.desc&limit=200`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )

    if (!res.ok) {
      console.error('Supabase error fetching beat maker items:', res.status)
      return NextResponse.json({ error: 'Failed to fetch beat maker items' }, { status: 500 })
    }

    const data = await res.json()

    const beats = (data || []).map((item: any) => ({
      id: item.id,
      title: item.title || 'Untitled Beat',
      audioUrl: item.audio_url,
      prompt: item.prompt,
      audio_format: item.audio_format || 'wav',
      duration: item.generation_params?.duration,
      model: item.generation_params?.model,
      credit_cost: item.generation_params?.credit_cost,
      plays: item.plays || 0,
      created_at: item.created_at,
    }))

    return NextResponse.json({ success: true, beats })
  } catch (error) {
    console.error('Error fetching beat maker items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
