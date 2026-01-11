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
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pusher = getPusherServer()
    if (!pusher) {
      return NextResponse.json({ error: 'Pusher not configured' }, { status: 503 })
    }

    const body = await req.text()
    const params = new URLSearchParams(body)
    const socketId = params.get('socket_id')
    const channelName = params.get('channel_name')

    if (!socketId || !channelName) {
      return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 })
    }

    // Verify user can access this channel
    // Allow private-user-{userId} channels AND presence-station-{stationId} channels
    const isPrivateUserChannel = channelName === `private-user-${userId}`
    const isPresenceStationChannel = channelName.startsWith('presence-station-')
    
    if (!isPrivateUserChannel && !isPresenceStationChannel) {
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

    return NextResponse.json(authResponse)

  } catch (error) {
    console.error('Pusher auth error:', error)
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 })
  }
}
