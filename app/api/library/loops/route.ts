import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'

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

    // Fetch all loops for this user
    const { data, error } = await supabase
      .from('combined_media')
      .select('id, title, audio_url, image_url, prompt, created_at, plays')
      .eq('user_id', userId)
      .eq('genre', 'loop')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error fetching loops:', error)
      return NextResponse.json({ error: 'Failed to fetch loops' }, { status: 500 })
    }

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
