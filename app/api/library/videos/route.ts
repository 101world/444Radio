import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's videos from combined_media table where type='video'
    const { data: videos, error } = await supabase
      .from('combined_media')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'video')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching videos:', error)
      return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
    }

    // Normalize field names for frontend compatibility
    const normalizedVideos = videos.map(video => ({
      ...video,
      audio_url: video.media_url || video.audio_url, // media_url is the primary field
      audioUrl: video.media_url || video.audio_url
    }))

    return NextResponse.json({ 
      success: true, 
      videos: normalizedVideos 
    })
  } catch (error) {
    console.error('Error in /api/library/videos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
