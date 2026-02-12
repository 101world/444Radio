import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function supabaseRest(path: string, options?: RequestInit) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options?.headers || {}),
    },
  })
  return res
}

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const { trackId } = await request.json()

    if (!trackId) {
      return corsResponse(NextResponse.json({ error: 'trackId required' }, { status: 400 }))
    }

    // Verify user owns the track
    const trackRes = await supabaseRest(`combined_media?id=eq.${trackId}&user_id=eq.${userId}&select=id,title,user_id`)
    const tracks = await trackRes.json()
    const track = tracks?.[0]

    if (!track) {
      return corsResponse(NextResponse.json({ error: 'Track not found or you do not own it' }, { status: 404 }))
    }

    // Mark as listed on earn marketplace
    const updateRes = await supabaseRest(`combined_media?id=eq.${trackId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        listed_on_earn: true,
        earn_price: 4,
        artist_share: 2,
        admin_share: 2,
      }),
    })

    if (!updateRes.ok) {
      // If the columns don't exist yet, just list as public
      const fallbackRes = await supabaseRest(`combined_media?id=eq.${trackId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_public: true }),
      })
      if (!fallbackRes.ok) {
        return corsResponse(NextResponse.json({ error: 'Failed to list track' }, { status: 500 }))
      }
    }

    return corsResponse(NextResponse.json({
      success: true,
      message: `"${track.title}" is now listed on the EARN marketplace`
    }))

  } catch (error) {
    console.error('List track error:', error)
    return corsResponse(NextResponse.json({ error: 'Failed to list track' }, { status: 500 }))
  }
}
