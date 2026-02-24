import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/voice-labs/messages?sessionId=xxx
 * List all messages for a session.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const sessionId = req.nextUrl.searchParams.get('sessionId')
    if (!sessionId) {
      return corsResponse(NextResponse.json({ error: 'Missing sessionId' }, { status: 400 }))
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/voice_labs_messages?session_id=eq.${sessionId}&clerk_user_id=eq.${userId}&select=id,text,voice_id,audio_url,credits_cost,settings,status,created_at&order=created_at.asc`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    if (!res.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to load messages' }, { status: 500 }))
    }

    const messages = await res.json()
    return corsResponse(NextResponse.json({ messages: messages || [] }))
  } catch (error) {
    console.error('❌ Voice Labs messages list error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}

/**
 * POST /api/voice-labs/messages
 * Save a generation message to a session.
 * Body: { sessionId, text, voice_id, audio_url, credits_cost, settings, status }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const { sessionId, text, voice_id, audio_url, credits_cost, settings, status } = body

    if (!sessionId || !text || !voice_id) {
      return corsResponse(NextResponse.json({ error: 'Missing required fields' }, { status: 400 }))
    }

    // Insert message
    const msgRes = await fetch(`${supabaseUrl}/rest/v1/voice_labs_messages`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        session_id: sessionId,
        clerk_user_id: userId,
        text,
        voice_id,
        audio_url: audio_url || null,
        credits_cost: credits_cost || 0,
        settings: settings || {},
        status: status || 'completed',
      }),
    })

    if (!msgRes.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to save message' }, { status: 500 }))
    }

    // Touch session updated_at
    await fetch(
      `${supabaseUrl}/rest/v1/voice_labs_sessions?id=eq.${sessionId}&clerk_user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ updated_at: new Date().toISOString() }),
      }
    )

    const data = await msgRes.json()
    const message = Array.isArray(data) ? data[0] : data
    return corsResponse(NextResponse.json({ message }))
  } catch (error) {
    console.error('❌ Voice Labs message save error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}
