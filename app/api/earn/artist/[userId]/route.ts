import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function supabaseRest(path: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
  })
  return res
}

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    // Fetch user profile
    const userRes = await supabaseRest(`users?clerk_user_id=eq.${userId}&select=clerk_user_id,username,avatar_url,bio,tagline`)
    const users = await userRes.json()
    const user = users?.[0]

    if (!user) {
      return corsResponse(NextResponse.json({ success: false, error: 'Artist not found' }, { status: 404 }))
    }

    // Fetch metrics from their tracks
    const tracksRes = await supabaseRest(`combined_media?user_id=eq.${userId}&select=id,plays,downloads`)
    const tracks = await tracksRes.json()

    const trackCount = (tracks || []).length
    const totalPlays = (tracks || []).reduce((sum: number, t: any) => sum + (t.plays || 0), 0)
    const totalDownloads = (tracks || []).reduce((sum: number, t: any) => sum + (t.downloads || 0), 0)

    return corsResponse(NextResponse.json({
      success: true,
      artist: {
        user_id: user.clerk_user_id,
        username: user.username || 'Unknown',
        avatar_url: user.avatar_url || null,
        bio: user.bio || user.tagline || null,
        trackCount,
        totalDownloads,
        totalPlays,
      }
    }))

  } catch (error) {
    console.error('Artist profile error:', error)
    return corsResponse(NextResponse.json({ success: false, error: 'Failed to fetch artist' }, { status: 500 }))
  }
}
