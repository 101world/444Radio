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

    console.log('📻 Station POST request:', { userId, isLive, username, currentTrack: currentTrack?.id })

    // Get username from users table if not provided
    let finalUsername = username
    if (!finalUsername || finalUsername === 'Unknown User') {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('username')
        .eq('clerk_user_id', userId)
        .single()
      
      if (userError) {
        console.error('❌ Failed to fetch username:', userError)
        return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
      }
      
      finalUsername = userData?.username || 'Anonymous'
      console.log('✅ Fetched username from database:', finalUsername)
    }

    // Check if station exists
    const { data: existingStation } = await supabase
      .from('live_stations')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (existingStation) {
      console.log('📝 Updating existing station:', existingStation.id)
      // Update existing station
      const updateData: any = {
        is_live: isLive,
        username: finalUsername, // Update username in case it changed
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

      if (error) {
        console.error('❌ Update error:', error)
        throw error
      }

      // If going offline, cleanup listeners
      if (!isLive) {
        await supabase
          .from('station_listeners')
          .delete()
          .eq('station_id', existingStation.id)
      }

      console.log('✅ Station updated successfully')
      return NextResponse.json({ success: true, station: data })
    } else {
      console.log('🆕 Creating new station for user:', userId)
      // Create new station
      const { data, error } = await supabase
        .from('live_stations')
        .insert({
          user_id: userId,
          username: finalUsername,
          is_live: isLive,
          current_track_id: currentTrack?.id || null,
          current_track_title: currentTrack?.title || null,
          current_track_image: currentTrack?.image_url || null,
          title: title || null
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Insert error:', error)
        throw error
      }
      
      console.log('✅ Station created successfully')
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
      // Get all live stations
      const { data: liveStationsData, error: stationsError } = await supabase
        .from('live_stations')
        .select('*')
        .eq('is_live', true)
        .order('started_at', { ascending: false })

      if (stationsError) {
        console.error('Error fetching live stations:', stationsError)
        return NextResponse.json({ success: true, stations: [] })
      }
      
      console.log('📻 Fetched live stations:', liveStationsData?.length || 0)
      
      if (!liveStationsData || liveStationsData.length === 0) {
        return NextResponse.json({ success: true, stations: [] })
      }

      // Get user data for all live station owners
      const userIds = liveStationsData.map(s => s.user_id)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('clerk_user_id, username, avatar_url')
        .in('clerk_user_id', userIds)

      if (usersError) {
        console.error('Error fetching users:', usersError)
      }

      // Create a map of user data by clerk_user_id
      const usersMap = new Map()
      usersData?.forEach(user => {
        usersMap.set(user.clerk_user_id, user)
      })
      
      // Format the response to include profile image and correct username
      const formattedStations = liveStationsData.map(station => {
        const userData = usersMap.get(station.user_id)
        console.log('Station data:', {
          id: station.id,
          old_username: station.username,
          user_id: station.user_id,
          has_user_data: !!userData,
          correct_username: userData?.username,
          avatar: userData?.avatar_url
        })
        return {
          ...station,
          username: userData?.username || station.username, // Use fresh username from users table
          profile_image: userData?.avatar_url || null
        }
      })
      
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
