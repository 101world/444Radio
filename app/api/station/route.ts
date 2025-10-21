import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - Go live or update station
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { isLive, currentTrack, username } = body

    // Check if station exists
    const { data: existingStation } = await supabase
      .from('live_stations')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (existingStation) {
      // Update existing station
      const { data, error } = await supabase
        .from('live_stations')
        .update({
          is_live: isLive,
          current_track_id: currentTrack?.id || null,
          current_track_title: currentTrack?.title || null,
          current_track_image: currentTrack?.image_url || null,
          updated_at: new Date().toISOString(),
          ...(isLive && { started_at: new Date().toISOString() })
        })
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      // If going offline, cleanup listeners
      if (!isLive) {
        await supabase
          .from('station_listeners')
          .delete()
          .eq('station_id', existingStation.id)
      }

      return NextResponse.json({ success: true, station: data })
    } else {
      // Create new station
      const { data, error } = await supabase
        .from('live_stations')
        .insert({
          user_id: userId,
          username: username,
          is_live: isLive,
          current_track_id: currentTrack?.id || null,
          current_track_title: currentTrack?.title || null,
          current_track_image: currentTrack?.image_url || null
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, station: data })
    }
  } catch (error) {
    console.error('Station POST error:', error)
    return NextResponse.json({ error: 'Failed to update station' }, { status: 500 })
  }
}

// GET - Get station status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      // Get all live stations
      const { data, error } = await supabase
        .from('live_stations')
        .select('*')
        .eq('is_live', true)
        .order('started_at', { ascending: false })

      if (error) throw error
      return NextResponse.json({ success: true, stations: data })
    }

    // Get specific user's station
    const { data, error } = await supabase
      .from('live_stations')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return NextResponse.json({ success: true, station: data || null })
  } catch (error) {
    console.error('Station GET error:', error)
    return NextResponse.json({ error: 'Failed to get station' }, { status: 500 })
  }
}
