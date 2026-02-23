import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/voice-trainings
 * 
 * List all trained voices for the current user.
 * Returns array of { id, voice_id, name, preview_url, status, created_at }
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/voice_trainings?clerk_user_id=eq.${userId}&select=id,voice_id,name,preview_url,status,source_audio_url,model,created_at&order=created_at.desc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        }
      }
    )

    if (!res.ok) {
      console.error('Failed to fetch voice trainings:', res.status)
      return corsResponse(NextResponse.json({ error: 'Failed to load voice trainings' }, { status: 500 }))
    }

    const voices = await res.json()
    return corsResponse(NextResponse.json({ voices: voices || [] }))

  } catch (error) {
    console.error('❌ Voice trainings list error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}

/**
 * DELETE /api/voice-trainings
 * 
 * Delete a trained voice by ID.
 * Body: { trainingId: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { trainingId } = await req.json()
    if (!trainingId) {
      return corsResponse(NextResponse.json({ error: 'Missing trainingId' }, { status: 400 }))
    }

    // Delete only if it belongs to the user
    const res = await fetch(
      `${supabaseUrl}/rest/v1/voice_trainings?id=eq.${trainingId}&clerk_user_id=eq.${userId}`,
      {
        method: 'DELETE',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: 'return=minimal',
        }
      }
    )

    if (!res.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to delete voice training' }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({ success: true }))

  } catch (error) {
    console.error('❌ Voice training delete error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}
