import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/earn/voices
 * 
 * Fetch all active voice listings for the marketplace.
 * Optionally filter by ?mine=true to show only the current user's listings.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    const { searchParams } = new URL(req.url)
    const mine = searchParams.get('mine') === 'true'

    let url = `${supabaseUrl}/rest/v1/voice_listings?is_active=eq.true&select=*,users!voice_listings_clerk_user_id_fkey(username,avatar_url)&order=created_at.desc`

    if (mine && userId) {
      url = `${supabaseUrl}/rest/v1/voice_listings?clerk_user_id=eq.${userId}&select=*,users!voice_listings_clerk_user_id_fkey(username,avatar_url)&order=created_at.desc`
    }

    const res = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      }
    })

    if (!res.ok) {
      console.error('Failed to fetch voice listings:', res.status)
      return corsResponse(NextResponse.json({ success: true, voices: [] }))
    }

    const listings = await res.json()

    const voices = (listings || []).map((l: any) => ({
      id: l.id,
      voice_id: l.voice_id,
      name: l.name,
      description: l.description || '',
      preview_url: l.preview_url,
      price_credits: l.price_credits || 0,
      total_uses: l.total_uses || 0,
      total_royalties_earned: l.total_royalties_earned || 0,
      clerk_user_id: l.clerk_user_id,
      username: l.users?.username || 'Unknown',
      avatar_url: l.users?.avatar_url || null,
      is_active: l.is_active,
      created_at: l.created_at,
    }))

    return corsResponse(NextResponse.json({ success: true, voices }))
  } catch (error) {
    console.error('Voice listings error:', error)
    return corsResponse(NextResponse.json({ success: false, error: 'Failed to fetch voice listings' }, { status: 500 }))
  }
}

/**
 * POST /api/earn/voices
 * 
 * List a trained voice on the marketplace.
 * Body: { voiceTrainingId: string, description?: string, pricCredits?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { voiceTrainingId, description = '', priceCredits = 0 } = await req.json()

    if (!voiceTrainingId) {
      return corsResponse(NextResponse.json({ error: 'Voice training ID is required' }, { status: 400 }))
    }

    // Fetch the voice training to verify ownership
    const vtRes = await fetch(
      `${supabaseUrl}/rest/v1/voice_trainings?id=eq.${voiceTrainingId}&clerk_user_id=eq.${userId}&select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const vtData = await vtRes.json()
    if (!vtData || vtData.length === 0) {
      return corsResponse(NextResponse.json({ error: 'Voice training not found or not owned by you' }, { status: 404 }))
    }

    const training = vtData[0]

    if (training.status !== 'ready') {
      return corsResponse(NextResponse.json({ error: 'Voice training is not ready' }, { status: 400 }))
    }

    // Check if already listed
    const existingRes = await fetch(
      `${supabaseUrl}/rest/v1/voice_listings?voice_id=eq.${training.voice_id}&select=id,is_active`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const existing = await existingRes.json()
    if (existing && existing.length > 0) {
      const activeListing = existing.find((l: any) => l.is_active)
      if (activeListing) {
        return corsResponse(NextResponse.json({ error: 'This voice is already listed' }, { status: 409 }))
      }
    }

    // Create listing
    const listingRes = await fetch(`${supabaseUrl}/rest/v1/voice_listings`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        voice_training_id: voiceTrainingId,
        clerk_user_id: userId,
        voice_id: training.voice_id,
        name: training.name,
        description: (description || '').substring(0, 500),
        preview_url: training.preview_url,
        price_credits: Math.max(0, Math.min(priceCredits || 0, 1000)),
        is_active: true,
      })
    })

    if (!listingRes.ok) {
      const errText = await listingRes.text()
      console.error('Failed to create voice listing:', errText)
      return corsResponse(NextResponse.json({ error: 'Failed to list voice' }, { status: 500 }))
    }

    const listing = await listingRes.json()
    const savedListing = Array.isArray(listing) ? listing[0] : listing

    return corsResponse(NextResponse.json({
      success: true,
      listing: savedListing,
    }))

  } catch (error) {
    console.error('Voice listing error:', error)
    return corsResponse(NextResponse.json({ error: 'Failed to list voice' }, { status: 500 }))
  }
}

/**
 * DELETE /api/earn/voices
 * 
 * Unlist a voice from the marketplace.
 * Body: { listingId: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { listingId } = await req.json()
    if (!listingId) {
      return corsResponse(NextResponse.json({ error: 'Listing ID is required' }, { status: 400 }))
    }

    // Soft delete — set is_active = false
    const res = await fetch(
      `${supabaseUrl}/rest/v1/voice_listings?id=eq.${listingId}&clerk_user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() })
      }
    )

    if (!res.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to unlist voice' }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({ success: true }))
  } catch (error) {
    console.error('Voice unlist error:', error)
    return corsResponse(NextResponse.json({ error: 'Failed to unlist voice' }, { status: 500 }))
  }
}
