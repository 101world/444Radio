// app/api/media/track-play/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(request: Request) {
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
  const { data: media } = await supabase
    .from('combined_media')
    .select('user_id')
    .eq('id', mediaId)
    .single()

  if (media && media.user_id === userId) {
    return corsResponse(
      NextResponse.json({ success: true, message: "Artist plays don't count" })
    )
  }

  // Increment play count using RPC function
  const { error } = await supabase.rpc('increment_plays', { media_id: mediaId })

  if (error) {
    console.error('Track play error:', error)
    return corsResponse(
      NextResponse.json({ error: 'Failed to update play count' }, { status: 500 })
    )
  }

  return corsResponse(NextResponse.json({ success: true }))
}