import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { trackId, userId } = await req.json()

    if (!trackId) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      )
    }

    // Get track info including artist
    const { data: currentSong } = await supabase
      .from('songs')
      .select('plays, user_id')
      .eq('id', trackId)
      .single()

    if (!currentSong) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      )
    }

    // Only increment plays if listener is not the artist
    if (userId && currentSong.user_id === userId) {
      return NextResponse.json({ 
        success: true,
        plays: currentSong.plays || 0,
        message: 'Artist play - not counted'
      })
    }

    const currentPlays = currentSong.plays || 0

    // Increment play count
    const { data, error } = await supabase
      .from('songs')
      .update({ 
        plays: currentPlays + 1
      })
      .eq('id', trackId)
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
