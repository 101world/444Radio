import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { mediaId, userId } = await req.json()

    if (!mediaId) {
      return NextResponse.json(
        { error: 'Media ID is required' },
        { status: 400 }
      )
    }

    // Get media info including artist
    const { data: currentMedia } = await supabase
      .from('combined_media')
      .select('plays, user_id')
      .eq('id', mediaId)
      .single()

    if (!currentMedia) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      )
    }

    // Only increment plays if listener is not the artist
    if (userId && currentMedia.user_id === userId) {
      return NextResponse.json({ 
        success: true,
        plays: currentMedia.plays || 0,
        message: 'Artist play - not counted'
      })
    }

    const currentPlays = currentMedia.plays || 0

    // Increment play count
    const { data, error } = await supabase
      .from('combined_media')
      .update({ 
        plays: currentPlays + 1
      })
      .eq('id', mediaId)
      .select('plays')
      .single()

    if (error) {
      console.error('Error updating play count:', error)
      return NextResponse.json(
        { error: 'Failed to update play count' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      plays: data?.plays || 0
    })
  } catch (error) {
    console.error('Error tracking play:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
