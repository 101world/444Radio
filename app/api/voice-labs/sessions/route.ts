import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/voice-labs/sessions
 * List all voice labs sessions for the current user.
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/voice_labs_sessions?clerk_user_id=eq.${userId}&select=id,title,voice_id,settings,created_at,updated_at&order=updated_at.desc`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    if (!res.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 }))
    }

    const sessions = await res.json()
    return corsResponse(NextResponse.json({ sessions: sessions || [] }))
  } catch (error) {
    console.error('❌ Voice Labs sessions list error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}

/**
 * POST /api/voice-labs/sessions
 * Create a new session.
 * Body: { title?: string, voice_id?: string, settings?: object }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json().catch(() => ({}))
    const title = (body.title || 'New Session').trim().substring(0, 200)
    const voice_id = body.voice_id || null
    const settings = body.settings || {}

    const res = await fetch(`${supabaseUrl}/rest/v1/voice_labs_sessions`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ clerk_user_id: userId, title, voice_id, settings }),
    })

    if (!res.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to create session' }, { status: 500 }))
    }

    const data = await res.json()
    const session = Array.isArray(data) ? data[0] : data
    return corsResponse(NextResponse.json({ session }))
  } catch (error) {
    console.error('❌ Voice Labs session create error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}

/**
 * DELETE /api/voice-labs/sessions
 * Delete a session and its messages.
 * Body: { sessionId: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { sessionId } = await req.json()
    if (!sessionId) {
      return corsResponse(NextResponse.json({ error: 'Missing sessionId' }, { status: 400 }))
    }

    // Delete session (cascades to messages)
    const res = await fetch(
      `${supabaseUrl}/rest/v1/voice_labs_sessions?id=eq.${sessionId}&clerk_user_id=eq.${userId}`,
      {
        method: 'DELETE',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: 'return=minimal' },
      }
    )
    if (!res.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to delete session' }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({ success: true }))
  } catch (error) {
    console.error('❌ Voice Labs session delete error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}

/**
 * PATCH /api/voice-labs/sessions
 * Rename a session.
 * Body: { sessionId: string, title: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { sessionId, title } = await req.json()
    if (!sessionId || !title) {
      return corsResponse(NextResponse.json({ error: 'Missing sessionId or title' }, { status: 400 }))
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/voice_labs_sessions?id=eq.${sessionId}&clerk_user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ title: title.trim().substring(0, 200), updated_at: new Date().toISOString() }),
      }
    )

    if (!res.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to rename session' }, { status: 500 }))
    }

    const data = await res.json()
    return corsResponse(NextResponse.json({ session: Array.isArray(data) ? data[0] : data }))
  } catch (error) {
    console.error('❌ Voice Labs session rename error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}
