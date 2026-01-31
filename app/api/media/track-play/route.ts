// app/api/media/track-play/route.ts
// Tracks play counts for combined_media after 3s of playback
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }

    const { mediaId } = await request.json()

    if (!mediaId) {
      return corsResponse(
        NextResponse.json({ error: 'Media ID is required' }, { status: 400 })
      )
    }

    // Check if user is the artist (per copilot instructions: "Artist plays don't count")
    const { data: media, error: fetchError } = await supabase
      .from('combined_media')
      .select('user_id')
      .eq('id', mediaId)
      .single()

    if (fetchError) {
      return corsResponse(
        NextResponse.json({ error: 'Media not found', details: fetchError.message }, { status: 404 })
      )
    }

    if (media && media.user_id === userId) {
      return corsResponse(
        NextResponse.json({ success: true, message: "Artist plays don't count", skipped: true })
      )
    }

    // Use atomic SQL function with ADMIN client to increment play count
    // (Admin client bypasses RLS restrictions)
    const { data, error: rpcError } = await supabaseAdmin
      .rpc('increment_play_count', { media_id: mediaId })

    if (rpcError) {
      return corsResponse(
        NextResponse.json({ error: 'Failed to update play count', details: rpcError.message }, { status: 500 })
      )
    }

    const newPlayCount = data || 0
    return corsResponse(NextResponse.json({ success: true, plays: newPlayCount }))
  } catch (error) {
    console.error('Track play exception:', error)
    return corsResponse(
      NextResponse.json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    )
  }
}