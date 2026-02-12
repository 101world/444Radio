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
    console.log('🔔 Signal endpoint called')
    
    const { userId } = await auth()
    console.log('🔐 User ID:', userId)
    
    if (!userId) {
      console.error('❌ No user ID in auth')
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const pusher = getPusherServer()
    if (!pusher) {
      console.error('❌ Pusher not configured')
      return corsResponse(NextResponse.json({ error: 'Pusher not configured' }, { status: 503 }))
    }

    const body = await req.json()
    console.log('📦 Request body:', { ...body, signal: '[REDACTED]' })
    
    const { stationId, signal, from, to, type } = body

    if (!stationId || !signal || !from || !to || !type) {
      console.error('❌ Missing fields:', { stationId: !!stationId, signal: !!signal, from: !!from, to: !!to, type: !!type })
      return corsResponse(NextResponse.json({ 
        error: 'Missing required fields: stationId, signal, from, to, type' 
      }, { status: 400 }))
    }

    // Verify sender is authenticated user
    if (from !== userId) {
      console.error('❌ User mismatch:', { from, userId })
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 403 }))
    }

    const channelName = `presence-station-${stationId}`
    console.log('📡 Triggering event on channel:', channelName)

    // Route signal to recipient based on type
    const eventName = type === 'viewer' ? 'viewer-signal' : 'host-signal'
    
    await pusher.trigger(channelName, eventName, {
      signal,
      from,
      to
    })

    console.log('✅ Signal sent successfully')
    return corsResponse(NextResponse.json({ success: true }))

  } catch (error: any) {
    console.error('❌ Signal routing error:', error)
    const pusherConfigured = !!(process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET && process.env.PUSHER_CLUSTER)
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      pusherConfigured,
      envVars: {
        PUSHER_APP_ID: !!process.env.PUSHER_APP_ID,
        PUSHER_KEY: !!process.env.PUSHER_KEY,
        PUSHER_SECRET: !!process.env.PUSHER_SECRET,
        PUSHER_CLUSTER: !!process.env.PUSHER_CLUSTER,
      }
    })

    // Return a clear error so the client can show a helpful message
    const statusCode = !pusherConfigured ? 503 : 500
    const userMessage = !pusherConfigured
      ? 'Live streaming is not configured. Pusher environment variables are missing.'
      : 'Signal routing failed. Please try refreshing the page.'
    return corsResponse(NextResponse.json({ 
      error: userMessage,
      details: error?.message || 'Unknown error',
      code: !pusherConfigured ? 'PUSHER_NOT_CONFIGURED' : 'SIGNAL_FAILED'
    }, { status: statusCode }))
  }
}
