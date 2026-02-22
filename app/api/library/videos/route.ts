import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Fetch videos from combined_media where video_url exists and is public
    const { data: videos, error } = await supabase
      .from('combined_media')
      .select(`
        id,
        title,
        audio_url,
        image_url,
        video_url,
        user_id,
        likes,
        plays,
        created_at,
        users!inner (
          username,
          avatar_url
        )
      `)
      .not('video_url', 'is', null)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching videos:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Transform the data to match expected format
    const transformedVideos = (videos || []).map((video: Record<string, unknown>) => {
      const users = video.users as { username?: string; avatar_url?: string } | undefined
      return {
        id: video.id,
        title: video.title,
        audio_url: video.audio_url,
        image_url: video.image_url,
        video_url: video.video_url,
        user_id: video.user_id,
        username: users?.username || 'Unknown',
        avatar_url: users?.avatar_url || null,
        likes: video.likes || 0,
        plays: video.plays || 0,
        created_at: video.created_at,
      }
    })

    return NextResponse.json({ success: true, videos: transformedVideos })
  } catch (error) {
    console.error('Error in videos API:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
