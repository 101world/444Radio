/**
 * WebRTC Signaling API
 * Routes signaling data between host and viewers for live streaming
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

    const { stationId, signal, from, to, type } = await req.json()

    if (!stationId || !signal || !from || !to || !type) {
      return corsResponse(NextResponse.json({ 
        error: 'Missing required fields: stationId, signal, from, to, type' 
      }, { status: 400 }))
    }

    // Verify sender is authenticated user
    if (from !== userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 403 }))
    }

    const channelName = `presence-station-${stationId}`

    // Route signal to recipient based on type
    const eventName = type === 'viewer' ? 'viewer-signal' : 'host-signal'
    
    await pusher.trigger(channelName, eventName, {
      signal,
      from,
      to
    })

    return corsResponse(NextResponse.json({ success: true }))

  } catch (error) {
    console.error('Signal routing error:', error)
    return corsResponse(NextResponse.json({ error: 'Signal failed' }, { status: 500 }))
  }
}
