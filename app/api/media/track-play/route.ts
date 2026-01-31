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
    console.log('🎯 track-play API called - userId from auth:', userId)
    
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }

    const { mediaId } = await request.json()
    console.log('🎯 track-play - mediaId:', mediaId)

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

    console.log('🎯 Media data:', { user_id: media?.user_id, plays: media?.plays, fetchError })

    if (fetchError) {
      console.error('❌ Fetch media error:', fetchError)
      return corsResponse(
        NextResponse.json({ error: 'Media not found', details: fetchError.message }, { status: 404 })
      )
    }

    if (media && media.user_id === userId) {
      console.log('🎯 Artist playing own track - skipping count')
      return corsResponse(
        NextResponse.json({ success: true, message: "Artist plays don't count" })
      )
    }

    console.log('🎯 Calling increment_play_count RPC...')
    // Use RPC to atomically increment play count
    const { data: result, error: rpcError } = await supabase.rpc('increment_play_count', {
      media_id: mediaId
    })

    console.log('🎯 RPC result:', { result, rpcError })

    if (rpcError) {
      console.error('❌ RPC increment error:', rpcError)
      // Fallback to manual increment if RPC doesn't exist
      console.log('🎯 Trying manual increment fallback...')
      const { error: updateError } = await supabase
        .from('combined_media')
        .update({ plays: (media?.plays || 0) + 1 })
        .eq('id', mediaId)

      if (updateError) {
        console.error('❌ Track play error:', updateError)
        return corsResponse(
          NextResponse.json({ error: 'Failed to update play count', details: updateError.message }, { status: 500 })
        )
      }
      
      console.log('✅ Manual increment success - new count:', (media?.plays || 0) + 1)
      return corsResponse(NextResponse.json({ success: true, plays: (media?.plays || 0) + 1 }))
    }

    console.log('✅ RPC increment success - new count:', result)
    return corsResponse(NextResponse.json({ success: true, plays: result }))
  } catch (error) {
    console.error('❌ Track play exception:', error)
    return corsResponse(
      NextResponse.json({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, { status: 500 })
    )
  }
}