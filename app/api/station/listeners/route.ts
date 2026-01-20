import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - Join a station
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { stationId, username } = body

    if (!stationId) {
      return NextResponse.json({ error: 'Station ID required' }, { status: 400 })
    }

    // stationId might be a username, so we need to find the actual station UUID
    // First try to find by username in live_stations
    const { data: stationData, error: stationError } = await supabase
      .from('live_stations')
      .select('id')
      .eq('username', stationId)
      .eq('is_live', true)
      .single()

    if (stationError || !stationData) {
      console.error('Station not found:', stationError)
      return NextResponse.json({ error: 'Station not found or not live' }, { status: 404 })
    }

    const actualStationId = stationData.id

    // Upsert listener (update last_seen if already exists)
    const { data, error } = await supabase
      .from('station_listeners')
      .upsert({
        station_id: actualStationId,
        user_id: userId,
        username: username,
        last_seen: new Date().toISOString()
      }, {
        onConflict: 'station_id,user_id'
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, listener: data })
  } catch (error) {
    console.error('Listener POST error:', error)
    return NextResponse.json({ error: 'Failed to join station' }, { status: 500 })
  }
}

// DELETE - Leave a station
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const stationId = searchParams.get('stationId')

    if (!stationId) {
      return NextResponse.json({ error: 'Station ID required' }, { status: 400 })
    }

    // stationId might be a username, so find the actual station UUID
    const { data: stationData, error: stationError } = await supabase
      .from('live_stations')
      .select('id')
      .eq('username', stationId)
      .single()

    const actualStationId = stationData?.id || stationId // fallback to provided id if not found

    const { error } = await supabase
      .from('station_listeners')
      .delete()
      .eq('station_id', actualStationId)
      .eq('user_id', userId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Listener DELETE error:', error)
    return NextResponse.json({ error: 'Failed to leave station' }, { status: 500 })
  }
}
