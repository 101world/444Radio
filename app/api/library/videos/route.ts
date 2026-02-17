import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🎥 [Videos API] Fetching videos for user:', userId)

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

    console.log('🎥 [Videos API] Type filter result:', { 
      count: videosByType?.length || 0, 
      error: typeError?.message,
      hasTypeColumn: !typeError?.message?.includes('column') 
    })

    if (videosByType && videosByType.length > 0) {
      videos = videosByType
      console.log('🎥 [Videos API] Found videos by type filter:', videos.length)
    } else {
      // Fallback: Fetch all user content and filter by video URLs
      const { data: allMedia, error: allError } = await supabase
        .from('combined_media')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      console.log('🎥 [Videos API] Fetched all media:', { 
        count: allMedia?.length || 0, 
        error: allError?.message 
      })

      if (allError) {
        console.error('Error fetching all media:', allError)
        return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
      }

      // Filter for videos based on URL patterns (mp4, webm, mov)
      videos = (allMedia || []).filter(item => {
        const url = item.audio_url || item.media_url || ''
        const isVideoUrl = url.match(/\.(mp4|webm|mov|avi)(\?.*)?$/i)
        const isVideoTitle = item.title?.includes('Video SFX')
        
        if (isVideoUrl || isVideoTitle) {
          console.log('🎥 [Videos API] Found video:', { 
            id: item.id, 
            title: item.title, 
            url: url.substring(0, 50) + '...',
            matchedBy: isVideoUrl ? 'URL pattern' : 'title'
          })
        }
        
        return isVideoUrl || isVideoTitle
      })
      
      console.log('🎥 [Videos API] Filtered videos by pattern:', videos.length)
    }

    // Normalize field names for frontend compatibility
    const normalizedVideos = videos.map(video => ({
      ...video,
      audioUrl: video.video_url || video.audio_url || video.media_url, // video_url is primary for visualizer videos
      media_url: video.video_url || video.audio_url || video.media_url, // For backwards compatibility
      video_url: video.video_url || video.media_url, // Ensure video_url is always set
    }))

    console.log('🎥 [Videos API] Returning normalized videos:', normalizedVideos.length)

    return NextResponse.json({ 
      success: true, 
      videos: normalizedVideos 
    })
  } catch (error) {
    console.error('Error in /api/library/videos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
