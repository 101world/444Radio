import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/library/voice-melody
 * Get user's Voice Melody generations from combined_media
 * Voice Melody saves with genre='voice-melody'
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?user_id=eq.${userId}&genre=eq.voice-melody&order=created_at.desc&select=id,title,audio_url,prompt,created_at,plays,metadata`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )

    if (!res.ok) {
      console.error('Supabase error fetching voice-melody items:', res.status)
      return corsResponse(NextResponse.json({ error: 'Failed to fetch voice-melody items' }, { status: 500 }))
    }

    const data = await res.json()

    const tracks = (data || []).map((item: any) => ({
      id: item.id,
      title: item.title || 'Untitled Voice Melody',
      audio_url: item.audio_url,
      audioUrl: item.audio_url,
      prompt: item.prompt,
      plays: item.plays || 0,
      created_at: item.created_at,
      metadata: item.metadata,
    }))

    return corsResponse(NextResponse.json({ success: true, tracks }))
  } catch (error) {
    console.error('Error fetching voice-melody items:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
