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

/**
 * Unlist (remove) a track from the EARN marketplace.
 * Only the track owner can unlist their own track.
 * No credit refund — the listing fee is non-refundable.
 */
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

    // 1. Verify user owns the track and it's currently listed
    const trackRes = await supabaseRest(
      `combined_media?id=eq.${trackId}&user_id=eq.${userId}&select=id,title,listed_on_earn`
    )
    const tracks = await trackRes.json()
    const track = tracks?.[0]

    if (!track) {
      return corsResponse(NextResponse.json({ error: 'Track not found or you do not own it' }, { status: 404 }))
    }

    if (!track.listed_on_earn) {
      return corsResponse(NextResponse.json({ error: 'Track is not currently listed' }, { status: 400 }))
    }

    // 2. Remove from earn marketplace
    const updateRes = await supabaseRest(`combined_media?id=eq.${trackId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        listed_on_earn: false,
        earn_price: null,
        artist_share: null,
        admin_share: null,
      }),
    })

    if (!updateRes.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to unlist track' }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({
      success: true,
      message: `"${track.title}" has been removed from the marketplace`,
    }))

  } catch (error) {
    console.error('Unlist error:', error)
    return corsResponse(NextResponse.json({ error: 'Failed to unlist track' }, { status: 500 }))
  }
}
