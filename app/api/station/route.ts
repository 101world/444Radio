import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Check if station is live or fetch stations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    const userId = searchParams.get('userId')
    const id = searchParams.get('id')

    // Query by station ID
    if (id) {
      const { data: station, error } = await supabase
        .from('live_stations')
        .select(`
          *,
          users:clerk_user_id (
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
        description: station.description || '',
        coverUrl: station.cover_url || station.current_track_image,
        genre: station.genre || '',
        isLive: station.is_live,
        listenerCount: station.listener_count || 0,
        lastLiveAt: station.last_live_at || station.updated_at,
        owner: {
          userId: station.clerk_user_id || station.users?.clerk_user_id,
          username: station.username || station.users?.username || 'Unknown',
          profileImage: station.users?.profile_image_url
        }
      }

      return NextResponse.json({ success: true, station: formatted })
    }
    
    // Query by username (for station page)
    if (username) {
      const { data: userData } = await supabase
        .from('users')
        .select('clerk_user_id')
        .eq('username', username)
        .single()
        
      if (!userData) {
        return NextResponse.json({ isLive: false })
      }
      
      const { data: stationData } = await supabase
        .from('live_stations')
        .select('*')
        .eq('clerk_user_id', userData.clerk_user_id)
        .eq('is_live', true)
        .single()
        
      return NextResponse.json({
        isLive: !!stationData,
        title: stationData?.title || `${username}'s Station`,
        username,
        listenerCount: stationData?.listener_count || 0
      })
    }

    // Get specific user's station by userId
    if (userId) {
      const { data, error } = await supabase
        .from('live_stations')
        .select('*')
        .eq('clerk_user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return NextResponse.json({ success: true, station: data || null })
    }

    // No params = Get all live stations
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
    const userIds = liveStationsData.map(s => s.clerk_user_id)
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
      const userData = usersMap.get(station.clerk_user_id)
      return {
        ...station,
        username: userData?.username || station.username,
        profile_image: userData?.avatar_url || null
      }
    })
    
    return NextResponse.json({ success: true, stations: formattedStations })
  } catch (error) {
    console.error('Station GET error:', error)
    return NextResponse.json({ error: 'Failed to get station' }, { status: 500 })
  }
}

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
        // Don't fail completely, use fallback
        finalUsername = 'Anonymous'
      } else {
        finalUsername = userData?.username || 'Anonymous'
        console.log('✅ Fetched username from database:', finalUsername)
      }
    } else {
      finalUsername = username || 'Anonymous'
    }
    
    console.log('🎯 Final username:', finalUsername)

    // Check if station exists
    const { data: existingStation } = await supabase
      .from('live_stations')
      .select('*')
      .eq('clerk_user_id', userId)
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
      
      // Only update title if provided and column exists
      if (title !== undefined) {
        updateData.title = title
      }

      console.log('🔄 Update data:', updateData)

      const { data, error } = await supabase
        .from('live_stations')
        .update(updateData)
        .eq('clerk_user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('❌ Update error:', error)
        console.error('❌ Update error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        
        // If it's a column not found error for title, retry without it
        if (error.message?.includes('title') || error.code === '42703') {
          console.log('⚠️ Title column not found, retrying without it...')
          delete updateData.title
          const { data: retryData, error: retryError } = await supabase
            .from('live_stations')
            .update(updateData)
            .eq('clerk_user_id', userId)
            .select()
            .single()
          
          if (retryError) {
            console.error('❌ Retry failed:', retryError)
            throw retryError
          }
          
          console.log('✅ Station updated successfully (without title)')
          return NextResponse.json({ success: true, station: retryData })
        }
        
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
      const insertData: any = {
        clerk_user_id: userId,
        username: finalUsername,
        is_live: isLive,
        current_track_id: currentTrack?.id || null,
        current_track_title: currentTrack?.title || null,
        current_track_image: currentTrack?.image_url || null
      }
      
      // Only add title if provided
      if (title) {
        insertData.title = title
      }
      
      console.log('🔄 Insert data:', insertData)

      const { data, error } = await supabase
        .from('live_stations')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error('❌ Insert error:', error)
        console.error('❌ Insert error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        
        // If it's a column not found error for title, retry without it
        if (error.message?.includes('title') || error.code === '42703') {
          console.log('⚠️ Title column not found, retrying without it...')
          delete insertData.title
          const { data: retryData, error: retryError } = await supabase
            .from('live_stations')
            .insert(insertData)
            .select()
            .single()
          
          if (retryError) {
            console.error('❌ Retry failed:', retryError)
            throw retryError
          }
          
          console.log('✅ Station created successfully (without title)')
          return NextResponse.json({ success: true, station: retryData })
        }
        
        throw error
      }
      
      console.log('✅ Station created successfully')
      return NextResponse.json({ success: true, station: data })
    }
  } catch (error) {
    console.error('Station POST error:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    return NextResponse.json({ 
      error: 'Failed to update station',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
