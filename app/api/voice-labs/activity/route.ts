import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { headers } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/voice-labs/activity
 * Log a Voice Labs activity event. Called by the client to track input sessions,
 * voice changes, settings changes, session opens/closes.
 *
 * Body: {
 *   event_type: string (required)
 *   session_id?: string
 *   text_length?: number
 *   text_snapshot?: string
 *   input_duration_ms?: number
 *   keystroke_count?: number
 *   paste_count?: number
 *   delete_count?: number
 *   revision_count?: number
 *   voice_id?: string
 *   tokens_consumed?: number
 *   credits_spent?: number
 *   generation_duration_ms?: number
 *   audio_url?: string
 *   settings?: object
 *   metadata?: object
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const eventType = body.event_type
    if (!eventType) {
      return corsResponse(NextResponse.json({ error: 'event_type is required' }, { status: 400 }))
    }

    const validEvents = [
      'input_start', 'input_end', 'generation_start', 'generation_complete',
      'generation_failed', 'voice_change', 'settings_change',
      'session_open', 'session_close',
    ]
    if (!validEvents.includes(eventType)) {
      return corsResponse(NextResponse.json({ error: 'Invalid event_type' }, { status: 400 }))
    }

    // Get request context
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim()
      || headersList.get('x-real-ip')
      || headersList.get('cf-connecting-ip')
      || 'unknown'
    const userAgent = headersList.get('user-agent') || 'unknown'

    const row: Record<string, unknown> = {
      user_id: userId,
      event_type: eventType,
      session_id: body.session_id || null,
      text_length: body.text_length ?? null,
      text_snapshot: eventType.startsWith('generation') ? (body.text_snapshot || null) : null,
      input_duration_ms: body.input_duration_ms ?? null,
      keystroke_count: body.keystroke_count ?? null,
      paste_count: body.paste_count ?? null,
      delete_count: body.delete_count ?? null,
      revision_count: body.revision_count ?? null,
      voice_id: body.voice_id || null,
      tokens_consumed: body.tokens_consumed ?? null,
      credits_spent: body.credits_spent ?? null,
      generation_duration_ms: body.generation_duration_ms ?? null,
      audio_url: body.audio_url || null,
      settings: body.settings || {},
      ip_address: ip,
      user_agent: userAgent,
      metadata: body.metadata || {},
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/voice_labs_activity`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    })

    if (!res.ok) {
      console.error('Failed to log voice labs activity:', res.status, await res.text())
      // Don't fail the client, just log
    }

    return corsResponse(NextResponse.json({ success: true }))
  } catch (error) {
    console.error('Voice labs activity error:', error)
    // Always return success so client is never blocked
    return corsResponse(NextResponse.json({ success: true }))
  }
}
