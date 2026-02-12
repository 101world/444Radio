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
 * Purchase (download) a track on the EARN marketplace.
 *
 * Pricing model:
 *   - Download costs 2 credits (fixed).
 *   - All 2 credits go to the artist.
 *   - Only subscribers (subscription_status = active | trialing) can purchase.
 *   - Optional stem-split adds 5 credits (still goes to artist).
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const { trackId, splitStems }: { trackId: string; splitStems: boolean } = await request.json()

    if (!trackId) {
      return corsResponse(NextResponse.json({ error: 'trackId required' }, { status: 400 }))
    }

    // 1. Fetch buyer — need credits + subscription_status
    const buyerRes = await supabaseRest(`users?clerk_user_id=eq.${userId}&select=clerk_user_id,credits,subscription_status`)
    const buyers = await buyerRes.json()
    const buyer = buyers?.[0]

    if (!buyer) {
      return corsResponse(NextResponse.json({ error: 'User not found' }, { status: 404 }))
    }

    // 2. Subscription gate — free users cannot download
    const isSubscribed = buyer.subscription_status === 'active' || buyer.subscription_status === 'trialing'
    if (!isSubscribed) {
      return corsResponse(
        NextResponse.json({ error: 'Subscription required. Upgrade at /pricing to download tracks.' }, { status: 403 })
      )
    }

    // 3. Fetch track details
    const trackRes = await supabaseRest(`combined_media?id=eq.${trackId}&select=id,user_id,title,audio_url,downloads`)
    const tracks = await trackRes.json()
    const track = tracks?.[0]

    if (!track) {
      return corsResponse(NextResponse.json({ error: 'Track not found' }, { status: 404 }))
    }

    // Prevent self-purchase
    if (track.user_id === userId) {
      return corsResponse(NextResponse.json({ error: 'Cannot purchase your own track' }, { status: 400 }))
    }

    // 4. Calculate cost — 2 base + optional 5 for stems
    const baseCost = 2
    const stemsCost = splitStems ? 5 : 0
    const totalCost = baseCost + stemsCost

    if ((buyer.credits || 0) < totalCost) {
      return corsResponse(NextResponse.json({ error: 'Insufficient credits' }, { status: 402 }))
    }

    // 5. Fetch artist's credits
    const artistRes = await supabaseRest(`users?clerk_user_id=eq.${track.user_id}&select=clerk_user_id,credits`)
    const artists = await artistRes.json()
    const artist = artists?.[0]

    if (!artist) {
      return corsResponse(NextResponse.json({ error: 'Artist account not found' }, { status: 500 }))
    }

    // 6. Deduct credits from buyer
    const newBuyerCredits = (buyer.credits || 0) - totalCost
    const deductRes = await supabaseRest(`users?clerk_user_id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ credits: newBuyerCredits }),
    })

    if (!deductRes.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 }))
    }

    // 7. Credit ALL to the artist (no admin share on downloads)
    const newArtistCredits = (artist.credits || 0) + totalCost
    const creditArtistRes = await supabaseRest(`users?clerk_user_id=eq.${track.user_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ credits: newArtistCredits }),
    })

    if (!creditArtistRes.ok) {
      // Rollback buyer deduction
      await supabaseRest(`users?clerk_user_id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ credits: buyer.credits }),
      })
      return corsResponse(NextResponse.json({ error: 'Failed to credit artist — rolled back' }, { status: 500 }))
    }

    // 8. Increment download count on track
    await supabaseRest(`combined_media?id=eq.${trackId}`, {
      method: 'PATCH',
      body: JSON.stringify({ downloads: (track.downloads || 0) + 1 }),
    })

    // 9. Record transaction
    try {
      await supabaseRest('earn_transactions', {
        method: 'POST',
        body: JSON.stringify({
          buyer_id: userId,
          seller_id: track.user_id,
          admin_id: null,
          track_id: trackId,
          total_cost: totalCost,
          artist_share: totalCost,
          admin_share: 0,
          split_stems: splitStems || false,
        }),
      })
    } catch (e) {
      console.error('Failed to record earn transaction:', e)
    }

    // 10. If split stems requested, queue the job
    let splitJobId = undefined
    if (splitStems) {
      try {
        const jobRes = await supabaseRest('earn_split_jobs', {
          method: 'POST',
          body: JSON.stringify({
            track_id: trackId,
            user_id: userId,
            status: 'queued',
          }),
        })
        const jobs = await jobRes.json()
        splitJobId = jobs?.[0]?.id
      } catch (e) {
        console.error('Failed to queue split stems:', e)
      }
    }

    return corsResponse(NextResponse.json({
      success: true,
      message: 'Purchase completed',
      transaction: {
        totalCost,
        artistShare: totalCost,
        adminShare: 0,
      },
      splitJobId,
    }))

  } catch (error) {
    console.error('Purchase error:', error)
    return corsResponse(NextResponse.json({ error: 'Purchase failed' }, { status: 500 }))
  }
}
