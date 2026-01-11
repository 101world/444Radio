/**
 * Station Reaction API
 * Broadcasts reactions (emojis) to all station members
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

    const { stationId, emoji, timestamp } = await req.json()

    if (!stationId || !emoji) {
      return corsResponse(NextResponse.json({ 
        error: 'Missing required fields: stationId, emoji' 
      }, { status: 400 }))
    }

    const channelName = `presence-station-${stationId}`

    await pusher.trigger(channelName, 'reaction', {
      emoji,
      userId,
      timestamp: timestamp || new Date().toISOString()
    })

    return corsResponse(NextResponse.json({ success: true }))

  } catch (error) {
    console.error('Reaction error:', error)
    return corsResponse(NextResponse.json({ error: 'Reaction failed' }, { status: 500 }))
  }
}
