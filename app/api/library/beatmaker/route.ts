import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * GET /api/library/beatmaker
 * Get user's beat maker generations from combined_media
 * Filters rows where genre = 'beatmaker'
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Query combined_media for beatmaker items
    const res = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?user_id=eq.${userId}&genre=eq.beatmaker&order=created_at.desc&limit=200&select=id,title,audio_url,prompt,created_at,metadata`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )

    if (!res.ok) {
      console.error('Supabase error fetching beat maker items:', res.status)

      // Fallback: also try music_library with JSONB filter for legacy data
      const fallbackRes = await fetch(
        `${supabaseUrl}/rest/v1/music_library?clerk_user_id=eq.${userId}&generation_params=cs.${encodeURIComponent('{"type":"beatmaker"}')}&order=created_at.desc&limit=200`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      )

      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json()
        const beats = (fallbackData || []).map((item: any) => ({
          id: item.id,
          title: item.title || 'Untitled Beat',
          audioUrl: item.audio_url,
          prompt: item.prompt,
          audio_format: item.audio_format || 'wav',
          duration: item.generation_params?.duration,
          model: item.generation_params?.model,
          credit_cost: item.generation_params?.credit_cost,
          created_at: item.created_at,
        }))
        return NextResponse.json({ success: true, beats })
      }

      return NextResponse.json({ error: 'Failed to fetch beat maker items' }, { status: 500 })
    }

    const data = await res.json()

    const beats = (data || []).map((item: any) => ({
      id: item.id,
      title: item.title || 'Untitled Beat',
      audioUrl: item.audio_url,
      prompt: item.prompt,
      audio_format: 'wav',
      duration: item.metadata?.duration,
      model: item.metadata?.model,
      credit_cost: item.metadata?.credit_cost,
      created_at: item.created_at,
    }))

    return NextResponse.json({ success: true, beats })
  } catch (error) {
    console.error('Error fetching beat maker items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
