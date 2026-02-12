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

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const { trackId, splitStems } = await request.json()

    if (!trackId) {
      return corsResponse(NextResponse.json({ error: 'trackId required' }, { status: 400 }))
    }

    // 1. Fetch track details
    const trackRes = await supabaseRest(`combined_media?id=eq.${trackId}&select=id,user_id,title,audio_url,earn_price`)
    const tracks = await trackRes.json()
    const track = tracks?.[0]
    
    if (!track) {
      return corsResponse(NextResponse.json({ error: 'Track not found' }, { status: 404 }))
    }

    // Prevent self-purchase
    if (track.user_id === userId) {
      return corsResponse(NextResponse.json({ error: 'Cannot purchase your own track' }, { status: 400 }))
    }

    const baseCost = track.earn_price || 4
    const stemsCost = splitStems ? 5 : 0
    const totalCost = baseCost + stemsCost
    const artistShare = 2
    const adminShare = 2

    // 2. Fetch buyer's credits
    const buyerRes = await supabaseRest(`users?clerk_user_id=eq.${userId}&select=clerk_user_id,credits`)
    const buyers = await buyerRes.json()
    const buyer = buyers?.[0]

    if (!buyer || (buyer.credits || 0) < totalCost) {
      return corsResponse(NextResponse.json({ error: 'Insufficient credits' }, { status: 402 }))
    }

    // 3. Fetch admin account
    const adminRes = await supabaseRest(`users?email=eq.${encodeURIComponent(ADMIN_EMAIL)}&select=clerk_user_id,credits`)
    const admins = await adminRes.json()
    const admin = admins?.[0]

    if (!admin) {
      console.error('Admin account not found for:', ADMIN_EMAIL)
      return corsResponse(NextResponse.json({ error: 'Platform configuration error' }, { status: 500 }))
    }

    // 4. Fetch artist's credits
    const artistRes = await supabaseRest(`users?clerk_user_id=eq.${track.user_id}&select=clerk_user_id,credits`)
    const artists = await artistRes.json()
    const artist = artists?.[0]

    if (!artist) {
      return corsResponse(NextResponse.json({ error: 'Artist account not found' }, { status: 500 }))
    }

    // 5. ATOMIC TRANSACTION — deduct from buyer, credit artist and admin
    // Deduct buyer credits
    const newBuyerCredits = (buyer.credits || 0) - totalCost
    const deductRes = await supabaseRest(`users?clerk_user_id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ credits: newBuyerCredits }),
    })

    if (!deductRes.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 }))
    }

    // Credit artist
    const newArtistCredits = (artist.credits || 0) + artistShare
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

    // Credit admin
    const newAdminCredits = (admin.credits || 0) + adminShare
    const creditAdminRes = await supabaseRest(`users?clerk_user_id=eq.${admin.clerk_user_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ credits: newAdminCredits }),
    })

    if (!creditAdminRes.ok) {
      // Rollback buyer and artist
      await supabaseRest(`users?clerk_user_id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ credits: buyer.credits }),
      })
      await supabaseRest(`users?clerk_user_id=eq.${track.user_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ credits: artist.credits }),
      })
      return corsResponse(NextResponse.json({ error: 'Failed to credit platform — rolled back' }, { status: 500 }))
    }

    // 6. Increment download count on track
    const currentDownloads = track.downloads || 0
    await supabaseRest(`combined_media?id=eq.${trackId}`, {
      method: 'PATCH',
      body: JSON.stringify({ downloads: currentDownloads + 1 }),
    })

    // 7. Record transaction
    try {
      await supabaseRest('earn_transactions', {
        method: 'POST',
        body: JSON.stringify({
          buyer_id: userId,
          seller_id: track.user_id,
          admin_id: admin.clerk_user_id,
          track_id: trackId,
          total_cost: totalCost,
          artist_share: artistShare,
          admin_share: adminShare,
          split_stems: splitStems || false,
        }),
      })
    } catch (e) {
      // Transaction record is secondary — don't fail the purchase
      console.error('Failed to record earn transaction:', e)
    }

    // 8. If split stems requested, queue the job
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
        artistShare,
        adminShare,
      },
      splitJobId,
    }))

  } catch (error) {
    console.error('Purchase error:', error)
    return corsResponse(NextResponse.json({ error: 'Purchase failed' }, { status: 500 }))
  }
}
