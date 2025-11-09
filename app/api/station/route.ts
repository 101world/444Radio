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
    const { isLive, currentTrack, username, title } = body

    // Check if station exists
    const { data: existingStation } = await supabase
      .from('live_stations')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (existingStation) {
      // Update existing station
      const updateData: any = {
        is_live: isLive,
        current_track_id: currentTrack?.id || null,
        current_track_title: currentTrack?.title || null,
        current_track_image: currentTrack?.image_url || null,
        updated_at: new Date().toISOString(),
        ...(isLive && { started_at: new Date().toISOString() })
      }
      
      // Update title if provided
      if (title !== undefined) {
        updateData.title = title
      }

      const { data, error } = await supabase
        .from('live_stations')
        .update(updateData)
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
          current_track_image: currentTrack?.image_url || null,
          title: title || null
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
    const id = searchParams.get('id')

    if (id) {
      // Get station by ID (from new stations table)
      const { data: station, error } = await supabase
        .from('stations')
        .select(`
          *,
          users:user_id (
            clerk_user_id,
            username,
            profile_image_url
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        console.error('Failed to fetch station:', error)
        return NextResponse.json({ error: 'Station not found' }, { status: 404 })
      }

      const formatted = {
        id: station.id,
        title: station.title,
        description: station.description,
        coverUrl: station.cover_url,
        genre: station.genre,
        isLive: station.is_live,
        listenerCount: station.listener_count || 0,
        lastLiveAt: station.last_live_at,
        owner: {
          userId: station.users?.clerk_user_id,
          username: station.users?.username || 'Unknown',
          profileImage: station.users?.profile_image_url
        }
      }

      return NextResponse.json({ success: true, station: formatted })
    }

    if (!userId) {
      // Get all live stations with user profile data
      const { data, error } = await supabase
        .from('live_stations')
        .select(`
          *,
          users:user_id (
            clerk_user_id,
            username,
            avatar_url
          )
        `)
        .eq('is_live', true)
        .order('started_at', { ascending: false })

      if (error) {
        console.error('Error fetching live stations:', error)
        // Return empty stations on error instead of throwing
        return NextResponse.json({ success: true, stations: [] })
      }
      
      console.log('📻 Fetched live stations:', data?.length || 0)
      
      // Format the response to include profile image
      const formattedStations = data?.map(station => {
        console.log('Station data:', {
          id: station.id,
          username: station.username,
          user_id: station.user_id,
          has_users_relation: !!station.users,
          avatar: station.users?.avatar_url
        })
        return {
          ...station,
          profile_image: station.users?.avatar_url || null
        }
      }) || []
      
      return NextResponse.json({ success: true, stations: formattedStations })
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
