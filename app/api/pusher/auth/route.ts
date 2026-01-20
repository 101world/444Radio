/**
 * Pusher Auth API
 * Authenticates users for private/presence channels
 * Supports:
 * - private-user-{userId} channels (for notifications)
 * - presence-station-{stationId} channels (for live streaming WebRTC)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getPusherServer } from '@/lib/pusher-server'

export async function POST(req: NextRequest) {
  try {
    console.log('🔐 Pusher auth endpoint called')
    
    const { userId } = await auth()
    console.log('User ID from auth:', userId)
    
    if (!userId) {
      console.error('❌ No user ID')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pusher = getPusherServer()
    if (!pusher) {
      console.error('❌ Pusher not configured')
      return NextResponse.json({ error: 'Pusher not configured' }, { status: 503 })
    }

    const body = await req.text()
    const params = new URLSearchParams(body)
    const socketId = params.get('socket_id')
    const channelName = params.get('channel_name')

    console.log('Auth request:', { socketId, channelName })

    if (!socketId || !channelName) {
      console.error('❌ Missing socket_id or channel_name')
      return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 })
    }

    // Verify user can access this channel
    // Allow private-user-{userId} channels AND presence-station-{stationId} channels
    const isPrivateUserChannel = channelName === `private-user-${userId}`
    const isPresenceStationChannel = channelName.startsWith('presence-station-')
    
    console.log('Channel check:', { isPrivateUserChannel, isPresenceStationChannel })
    
    if (!isPrivateUserChannel && !isPresenceStationChannel) {
      console.error('❌ Unauthorized channel:', channelName)
      return NextResponse.json({ 
        error: 'Unauthorized channel',
        channelName,
        userId 
      }, { status: 403 })
    }

    // Authenticate the channel (presence channels need user_id for member info)
    const authResponse = isPresenceStationChannel
      ? pusher.authorizeChannel(socketId, channelName, {
          user_id: userId,
          user_info: { userId }
        })
      : pusher.authorizeChannel(socketId, channelName, {
          user_id: userId,
        })

    console.log('✅ Auth successful for channel:', channelName)
    return NextResponse.json(authResponse)

  } catch (error: any) {
    console.error('❌ Pusher auth error:', error)
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack
    })
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 })
  }
}
