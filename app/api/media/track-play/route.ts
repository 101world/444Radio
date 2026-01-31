// app/api/media/track-play/route.ts
// Tracks play counts for combined_media after 3s of playback
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
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
      .select('user_id, plays')
      .eq('id', mediaId)
      .single()

    if (fetchError) {
      console.error('Fetch media error:', fetchError)
      return corsResponse(
        NextResponse.json({ error: 'Media not found', details: fetchError.message }, { status: 404 })
      )
    }

    if (media && media.user_id === userId) {
      console.log('🚫 SKIPPING: Artist playing own track')
      console.log('   Track user_id:', media.user_id)
      console.log('   Logged in userId:', userId)
      return corsResponse(
        NextResponse.json({ success: true, message: "Artist plays don't count", skipped: true })
      )
    }

    console.log('✅ TRACKING: Different user playing track')
    console.log('   Track user_id:', media.user_id)
    console.log('   Logged in userId:', userId)

    // Increment play count directly with UPDATE
    const currentPlays = media?.plays || 0
    const { error: updateError } = await supabase
      .from('combined_media')
      .update({ plays: currentPlays + 1 })
      .eq('id', mediaId)

    if (updateError) {
      console.error('Track play error:', updateError)
      return corsResponse(
        NextResponse.json({ error: 'Failed to update play count', details: updateError.message }, { status: 500 })
      )
    }

    console.log('Play count incremented for', mediaId, '- new count:', currentPlays + 1)
    return corsResponse(NextResponse.json({ success: true, plays: currentPlays + 1 }))
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