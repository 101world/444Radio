import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * GET /api/library/beatmaker
 * Get user's beat maker generations from music_library
 * Filters rows where generation_params contains model = cassetteai-music-generator
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use JSONB contains operator to match beat maker model
    const res = await fetch(
      `${supabaseUrl}/rest/v1/music_library?clerk_user_id=eq.${userId}&generation_params=cs.${encodeURIComponent('{"model":"cassetteai-music-generator"}')}&order=created_at.desc&limit=200`,
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
      duration: item.duration || item.generation_params?.duration,
      model: item.generation_params?.model,
      credit_cost: item.generation_params?.credit_cost,
      created_at: item.created_at,
    }))

    return NextResponse.json({ success: true, beats })
  } catch (error) {
    console.error('Error fetching beat maker items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
