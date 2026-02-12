import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ADMIN_EMAIL = '444radioog@gmail.com'

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

const LISTING_FEE = 2

/**
 * List a track on the EARN marketplace.
 *
 * Pricing model:
 *   - Listing costs 2 credits — one-time fee paid to 444 Radio admin.
 *   - Artist must own the track.
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

    // 1. Verify user owns the track
    // Try with listed_on_earn column first, fall back without it if column doesn't exist yet
    let trackRes = await supabaseRest(`combined_media?id=eq.${trackId}&user_id=eq.${userId}&select=id,title,user_id,listed_on_earn`)
    let tracks: any[]
    if (!trackRes.ok) {
      // Column probably doesn't exist yet — query without it
      trackRes = await supabaseRest(`combined_media?id=eq.${trackId}&user_id=eq.${userId}&select=id,title,user_id`)
      tracks = await trackRes.json()
    } else {
      tracks = await trackRes.json()
    }
    const track = tracks?.[0]

    if (!track) {
      return corsResponse(NextResponse.json({ error: 'Track not found or you do not own it' }, { status: 404 }))
    }

    if (track.listed_on_earn) {
      return corsResponse(NextResponse.json({ error: 'Track is already listed' }, { status: 400 }))
    }

    // 2. Fetch lister's credits
    const userRes = await supabaseRest(`users?clerk_user_id=eq.${userId}&select=clerk_user_id,credits`)
    const users = await userRes.json()
    const user = users?.[0]

    if (!user || (user.credits || 0) < LISTING_FEE) {
      return corsResponse(NextResponse.json({ error: `You need at least ${LISTING_FEE} credits to list a track` }, { status: 402 }))
    }

    // 3. Fetch admin account to credit
    const adminRes = await supabaseRest(`users?email=eq.${encodeURIComponent(ADMIN_EMAIL)}&select=clerk_user_id,credits`)
    const admins = await adminRes.json()
    const admin = admins?.[0]

    if (!admin) {
      console.error('Admin account not found for:', ADMIN_EMAIL)
      return corsResponse(NextResponse.json({ error: 'Platform configuration error' }, { status: 500 }))
    }

    // 4. Deduct credits from lister
    const newUserCredits = (user.credits || 0) - LISTING_FEE
    const deductRes = await supabaseRest(`users?clerk_user_id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ credits: newUserCredits }),
    })

    if (!deductRes.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to deduct listing fee' }, { status: 500 }))
    }

    // 5. Credit admin
    const newAdminCredits = (admin.credits || 0) + LISTING_FEE
    const creditAdminRes = await supabaseRest(`users?clerk_user_id=eq.${admin.clerk_user_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ credits: newAdminCredits }),
    })

    if (!creditAdminRes.ok) {
      // Rollback lister deduction
      await supabaseRest(`users?clerk_user_id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ credits: user.credits }),
      })
      return corsResponse(NextResponse.json({ error: 'Failed to credit platform — rolled back' }, { status: 500 }))
    }

    // 6. Mark track as listed on earn marketplace
    const updateRes = await supabaseRest(`combined_media?id=eq.${trackId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        listed_on_earn: true,
        earn_price: 2,
        artist_share: 2,
        admin_share: 0,
      }),
    })

    if (!updateRes.ok) {
      const errText = await updateRes.text().catch(() => 'unknown')
      console.warn('Earn columns PATCH failed (columns may not exist yet):', errText)
      // Fallback: set is_public so the track still appears
      const fallbackRes = await supabaseRest(`combined_media?id=eq.${trackId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_public: true }),
      })
      if (!fallbackRes.ok) {
        // Rollback both credit operations
        await supabaseRest(`users?clerk_user_id=eq.${userId}`, {
          method: 'PATCH',
          body: JSON.stringify({ credits: user.credits }),
        })
        await supabaseRest(`users?clerk_user_id=eq.${admin.clerk_user_id}`, {
          method: 'PATCH',
          body: JSON.stringify({ credits: admin.credits }),
        })
        return corsResponse(NextResponse.json({ error: 'Failed to list track — rolled back' }, { status: 500 }))
      }
    }

    // 7. Record the listing fee transaction (best-effort — table may not exist yet)
    try {
      const txRes = await supabaseRest('earn_transactions', {
        method: 'POST',
        body: JSON.stringify({
          buyer_id: userId,
          seller_id: admin.clerk_user_id,
          admin_id: admin.clerk_user_id,
          track_id: trackId,
          total_cost: LISTING_FEE,
          artist_share: 0,
          admin_share: LISTING_FEE,
          split_stems: false,
        }),
      })
      if (!txRes.ok) {
        console.warn('earn_transactions insert failed (table may not exist yet):', await txRes.text().catch(() => ''))
      }
    } catch (e) {
      console.error('Failed to record listing transaction:', e)
    }

    return corsResponse(NextResponse.json({
      success: true,
      message: `"${track.title}" is now listed on the EARN marketplace`,
      creditsDeducted: LISTING_FEE,
    }))

  } catch (error) {
    console.error('List track error:', error)
    return corsResponse(NextResponse.json({ error: 'Failed to list track' }, { status: 500 }))
  }
}
