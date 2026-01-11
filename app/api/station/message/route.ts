/**
 * Station Chat Message API
 * Broadcasts chat messages to all station members
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

    const { stationId, message, username, avatar, timestamp } = await req.json()

    if (!stationId || !message || !username) {
      return corsResponse(NextResponse.json({ 
        error: 'Missing required fields: stationId, message, username' 
      }, { status: 400 }))
    }

    const channelName = `presence-station-${stationId}`

    await pusher.trigger(channelName, 'chat-message', {
      message,
      username,
      avatar,
      userId,
      timestamp: timestamp || new Date().toISOString()
    })

    return corsResponse(NextResponse.json({ success: true }))

  } catch (error) {
    console.error('Chat message error:', error)
    return corsResponse(NextResponse.json({ error: 'Message failed' }, { status: 500 }))
  }
}
