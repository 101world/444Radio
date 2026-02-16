import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/library/autotune
 * Returns all autotuned (pitch corrected) tracks for the current user.
 * These are stored with genre='processed' in combined_media.
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { data: tracks, error } = await supabase
      .from('combined_media')
      .select('id, title, audio_url, image_url, genre, prompt, created_at')
      .eq('user_id', userId)
      .eq('genre', 'processed')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Autotune Library API] Error:', error.message)
      return corsResponse(NextResponse.json({ error: 'Failed to fetch autotune tracks' }, { status: 500 }))
    }

    // Normalize audio_url → audioUrl for frontend compatibility
    const normalized = (tracks || []).map(t => ({
      ...t,
      audioUrl: t.audio_url,
      imageUrl: t.image_url,
    }))

    return corsResponse(NextResponse.json({ success: true, tracks: normalized }))
  } catch (error) {
    console.error('[Autotune Library API] Unexpected error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
