import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * GET /api/library/cover
 * Get user's 444 Cover generations from combined_media
 * Filters rows where genre = '444-cover'
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?user_id=eq.${userId}&genre=eq.444-cover&order=created_at.desc&limit=200&select=id,title,audio_url,audio_prompt,lyrics,created_at,plays,metadata`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )

    if (!res.ok) {
      console.error('Supabase error fetching cover items:', res.status)

      const fallbackRes = await fetch(
        `${supabaseUrl}/rest/v1/music_library?clerk_user_id=eq.${userId}&generation_params=cs.${encodeURIComponent('{"type":"444-cover"}')}&order=created_at.desc&limit=200`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      )

      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json()
        const tracks = (fallbackData || []).map((item: any) => ({
          id: item.id,
          title: item.title || 'Untitled Cover',
          audioUrl: item.audio_url,
          audio_url: item.audio_url,
          prompt: item.prompt,
          lyrics: item.lyrics,
          audio_format: item.audio_format || 'wav',
          created_at: item.created_at,
        }))
        return NextResponse.json({ success: true, tracks })
      }

      return NextResponse.json({ error: 'Failed to fetch cover items' }, { status: 500 })
    }

    const data = await res.json()

    const tracks = (data || []).map((item: any) => ({
      id: item.id,
      title: item.title || 'Untitled Cover',
      audioUrl: item.audio_url,
      audio_url: item.audio_url,
      prompt: item.audio_prompt,
      lyrics: item.lyrics,
      plays: item.plays || 0,
      audio_format: 'wav',
      created_at: item.created_at,
      metadata: item.metadata,
    }))

    return NextResponse.json({ success: true, tracks })
  } catch (error) {
    console.error('Error fetching cover items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
