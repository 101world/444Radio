import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/library/loops
 * Get user's loop generations from combined_media
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all loops for this user — use service role key to bypass RLS
    const res = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?user_id=eq.${userId}&genre=eq.loop&order=created_at.desc&select=id,title,audio_url,image_url,prompt,created_at,plays`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )

    if (!res.ok) {
      console.error('Supabase error fetching loops:', res.status)
      return NextResponse.json({ error: 'Failed to fetch loops' }, { status: 500 })
    }

    const data = await res.json()

    const loops = (data || []).map((item: any) => ({
      id: item.id,
      title: item.title || 'Untitled Loop',
      audioUrl: item.audio_url,
      imageUrl: item.image_url,
      prompt: item.prompt,
      plays: item.plays || 0,
      createdAt: item.created_at
    }))

    return NextResponse.json({ success: true, loops })
  } catch (error) {
    console.error('Error fetching loops:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
