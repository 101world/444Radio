import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stationId, isLive } = await request.json()

    if (!stationId) {
      return NextResponse.json({ error: 'Station ID required' }, { status: 400 })
    }

    // Verify user owns the station
    const { data: station, error: fetchError } = await supabase
      .from('stations')
      .select('user_id')
      .eq('id', stationId)
      .single()

    if (fetchError || !station) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 })
    }

    if (station.user_id !== userId) {
      return NextResponse.json({ error: 'Not authorized to control this station' }, { status: 403 })
    }

    // Update live status
    const { data: updated, error } = await supabase
      .from('stations')
      .update({ 
        is_live: isLive,
        last_live_at: isLive ? new Date().toISOString() : undefined
      })
      .eq('id', stationId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update station status:', error)
      return NextResponse.json({ error: 'Failed to update station' }, { status: 500 })
    }

    return corsResponse(NextResponse.json({ success: true, station: updated }))
  } catch (error) {
    console.error('Go live error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
