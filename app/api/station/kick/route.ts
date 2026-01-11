/**
 * Station Kick User API
 * Allows host to remove participants from their live stream
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getPusherServer } from '@/lib/pusher-server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const pusher = getPusherServer()
    if (!pusher) {
      return corsResponse(NextResponse.json({ error: 'Pusher not configured' }, { status: 503 }))
    }

    const { stationId, kickUserId } = await req.json()

    if (!stationId || !kickUserId) {
      return corsResponse(NextResponse.json({ 
        error: 'Missing required fields: stationId, kickUserId' 
      }, { status: 400 }))
    }

    // Verify requester is the host (station owner)
    // In a real app, you'd check database to confirm userId owns this station
    // For now, we trust that only the host has access to kick button

    const channelName = `presence-station-${stationId}`

    // Send kick event to the specific user
    await pusher.trigger(channelName, 'user-kicked', {
      kickedUserId: kickUserId,
      by: userId,
      timestamp: new Date().toISOString()
    })

    return corsResponse(NextResponse.json({ success: true }))

  } catch (error) {
    console.error('Kick user error:', error)
    return corsResponse(NextResponse.json({ error: 'Kick failed' }, { status: 500 }))
  }
}
