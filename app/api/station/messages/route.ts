import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - Send a message
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { stationId, message, messageType, username } = body

    if (!stationId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('station_messages')
      .insert({
        station_id: stationId,
        user_id: userId,
        username: username,
        message: message,
        message_type: messageType || 'chat'
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, message: data })
  } catch (error) {
    console.error('Message POST error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}

// GET - Get messages for a station
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const stationId = searchParams.get('stationId')
    const limit = parseInt(searchParams.get('limit') || '100')

    if (!stationId) {
      return NextResponse.json({ error: 'Station ID required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('station_messages')
      .select('*')
      .eq('station_id', stationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return NextResponse.json({ success: true, messages: data.reverse() })
  } catch (error) {
    console.error('Message GET error:', error)
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 })
  }
}
