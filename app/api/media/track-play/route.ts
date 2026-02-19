// app/api/media/track-play/route.ts
// Tracks play counts for combined_media after 3s of playback
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logPlay } from '@/lib/activity-logger'

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

    // Skip play tracking for non-UUID IDs (e.g. stem playback IDs like "123-output.demucs_vocals")
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_REGEX.test(mediaId)) {
      return corsResponse(
        NextResponse.json({ success: true, message: 'Non-database media, play tracking skipped', skipped: true })
      )
    }

    // Check if user is the artist (per copilot instructions: "Artist plays don't count")
    // Use admin client to bypass RLS — avoids false 404s when RLS blocks the select
    const { data: media, error: fetchError } = await supabaseAdmin
      .from('combined_media')
      .select('user_id')
      .eq('id', mediaId)
      .single()

    if (fetchError) {
      console.error('Track-play media lookup failed:', fetchError.message, 'mediaId:', mediaId)
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

    // Log the play activity (non-blocking)
    logPlay(userId, mediaId).catch(err => console.error('[Track-play] Activity log failed:', err))

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