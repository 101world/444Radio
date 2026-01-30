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
      return corsResponse(
        NextResponse.json({ success: true, message: "Artist plays don't count" })
      )
    }

    // Use RPC to atomically increment play count
    const { data: result, error: rpcError } = await supabase.rpc('increment_play_count', {
      media_id: mediaId
    })

    if (rpcError) {
      console.error('RPC increment error:', rpcError)
      // Fallback to manual increment if RPC doesn't exist
      const { error: updateError } = await supabase
        .from('combined_media')
        .update({ plays: (media?.plays || 0) + 1 })
        .eq('id', mediaId)

      if (updateError) {
        console.error('Track play error:', updateError)
        return corsResponse(
          NextResponse.json({ error: 'Failed to update play count', details: updateError.message }, { status: 500 })
        )
      }
      
      return corsResponse(NextResponse.json({ success: true, plays: (media?.plays || 0) + 1 }))
    }

    return corsResponse(NextResponse.json({ success: true, plays: result }))
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