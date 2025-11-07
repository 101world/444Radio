import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET() {
  try {
    // Fetch all stations, with live ones first
    const { data: stations, error } = await supabase
      .from('stations')
      .select(`
        *,
        users:user_id (
          clerk_user_id,
          username,
          profile_image_url
        )
      `)
      .order('is_live', { ascending: false })
      .order('listener_count', { ascending: false })
      .order('last_live_at', { ascending: false, nullsFirst: false })
      .limit(50)

    if (error) {
      console.error('Failed to fetch stations:', error)
      return NextResponse.json({ error: 'Failed to fetch stations' }, { status: 500 })
    }

    // Format response
    const formattedStations = stations.map(station => ({
      id: station.id,
      title: station.title,
      description: station.description,
      coverUrl: station.cover_url,
      genre: station.genre,
      isLive: station.is_live,
      listenerCount: station.listener_count || 0,
      lastLiveAt: station.last_live_at,
      createdAt: station.created_at,
      owner: {
        userId: station.users?.clerk_user_id,
        username: station.users?.username || 'Unknown',
        profileImage: station.users?.profile_image_url
      }
    }))

    return corsResponse(NextResponse.json({ 
      success: true, 
      stations: formattedStations,
      liveCount: formattedStations.filter(s => s.isLive).length
    }))
  } catch (error) {
    console.error('List stations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
