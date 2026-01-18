import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's videos from combined_media table
    // Strategy: Try filtering by type='video' first (if column exists)
    // If that fails or returns empty, fetch all and filter by video URL patterns
    let videos = []
    
    // Try with type filter (if column exists)
    const { data: videosByType, error: typeError } = await supabase
      .from('combined_media')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'video')
      .order('created_at', { ascending: false })

    if (videosByType && videosByType.length > 0) {
      videos = videosByType
    } else {
      // Fallback: Fetch all user content and filter by video URLs
      const { data: allMedia, error: allError } = await supabase
        .from('combined_media')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (allError) {
        console.error('Error fetching all media:', allError)
        return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
      }

      // Filter for videos based on URL patterns (mp4, webm, mov)
      videos = (allMedia || []).filter(item => {
        const url = item.audio_url || item.media_url || ''
        return url.match(/\.(mp4|webm|mov|avi)(\?.*)?$/i) || item.title?.includes('Video SFX')
      })
    }

    // Normalize field names for frontend compatibility
    const normalizedVideos = videos.map(video => ({
      ...video,
      audioUrl: video.audio_url, // audio_url is the primary field for video storage
      media_url: video.audio_url // For backwards compatibility
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
