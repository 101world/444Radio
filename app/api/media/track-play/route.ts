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

    // Check if this user has already played this song today
    if (userId) {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
      
      // Try to insert play credit (will fail if already exists due to UNIQUE constraint)
      const { error: playError } = await supabase
        .from('play_credits')
        .insert({
          media_id: mediaId,
          user_id: userId,
          played_on: today
        })

      // If insert failed due to duplicate, user already played today
      if (playError) {
        // Check if it's a duplicate error (PostgreSQL code 23505)
        if (playError.code === '23505') {
          return NextResponse.json({ 
            success: true,
            plays: currentMedia.plays || 0,
            message: 'Already counted today - 1 play per user per day',
            alreadyCounted: true
          })
        }
        // Other errors - log but continue
        console.error('Error inserting play credit:', playError)
      }
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
      plays: data?.plays || 0,
      message: 'Play counted'
    })
  } catch (error) {
    console.error('Error tracking play:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
