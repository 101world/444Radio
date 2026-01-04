import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsResponse, handleOptions } from '@/lib/cors'

// DEPRECATED: Use /api/media/track-play instead
// This route duplicates the media endpoint for backward compatibility

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: Request) {
  console.warn('⚠️ [DEPRECATED] /api/songs/track-play called, use /api/media/track-play instead')
  
  try {
    const { mediaId, userId, songId } = await req.json()
    const id = mediaId || songId // Support both parameter names

    if (!id) {
      return corsResponse(NextResponse.json(
        { error: 'Media ID is required' },
        { status: 400 }
      ))
    }

    // Get media info
    const { data: currentMedia } = await supabase
      .from('combined_media')
      .select('plays, user_id')
      .eq('id', id)
      .single()

    if (!currentMedia) {
      // Gracefully ignore missing media to prevent noisy 404s on fallback
      return corsResponse(NextResponse.json({
        success: true,
        plays: 0,
        message: 'Media not found - play not counted'
      }))
    }

    // Don't count artist's own plays
    if (userId && currentMedia.user_id === userId) {
      return corsResponse(NextResponse.json({ 
        success: true,
        plays: currentMedia.plays || 0,
        message: 'Artist play - not counted'
      }))
    }

    // Increment play count
    const { data, error } = await supabase
      .from('combined_media')
      .update({ 
        plays: (currentMedia.plays || 0) + 1
      })
      .eq('id', id)
      .select('plays')
      .single()

    if (error) {
      console.error('Error updating play count:', error)
      return corsResponse(NextResponse.json(
        { error: 'Failed to update play count' },
        { status: 500 }
      ))
    }

    return corsResponse(NextResponse.json({ 
      success: true,
      plays: data?.plays || 0
    }))
  } catch (error) {
    console.error('Error tracking play:', error)
    return corsResponse(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ))
  }
}
