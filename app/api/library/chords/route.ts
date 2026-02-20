import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/library/chords
 * Get user's chord generations from combined_media
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all chords for this user
    const { data, error } = await supabase
      .from('combined_media')
      .select('id, title, audio_url, image_url, prompt, chord_progression, time_signature, created_at, plays')
      .eq('user_id', userId)
      .eq('genre', 'chords')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error fetching chords:', error)
      return NextResponse.json({ error: 'Failed to fetch chords' }, { status: 500 })
    }

    const chords = (data || []).map((item: any) => ({
      id: item.id,
      title: item.title || 'Untitled Chords',
      audioUrl: item.audio_url,
      imageUrl: item.image_url,
      prompt: item.prompt,
      chord_progression: item.chord_progression,
      time_signature: item.time_signature,
      plays: item.plays || 0,
      created_at: item.created_at
    }))

    return NextResponse.json({ success: true, chords })
  } catch (error) {
    console.error('Error fetching chords:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
