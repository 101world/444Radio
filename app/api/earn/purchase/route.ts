import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { logOwnershipEvent, recordDownloadLineage } from '@/lib/ownership-engine'

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
 *   - Download costs 5 credits (fixed).
 *   - 1 credit goes to the artist, 4 credits go to 444 Radio.
 *   - Only subscribers (subscription_status = active | trialing) can purchase.
 *   - Optional stem-split adds 5 credits.
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

    // 1. Fetch buyer — need credits + subscription_status + username
    const buyerRes = await supabaseRest(`users?clerk_user_id=eq.${userId}&select=clerk_user_id,credits,subscription_status,username`)
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

    // 3. Fetch track details (include image_url + metadata for library save)
    const trackRes = await supabaseRest(`combined_media?id=eq.${trackId}&select=id,user_id,title,audio_url,image_url,genre,mood,bpm,key_signature,downloads,track_id_444,original_creator_id,license_type_444,remix_allowed,derivative_allowed`)
    const tracks = await trackRes.json()
    const track = tracks?.[0]

    if (!track) {
      return corsResponse(NextResponse.json({ error: 'Track not found' }, { status: 404 }))
    }

    // Prevent self-purchase
    if (track.user_id === userId) {
      return corsResponse(NextResponse.json({ error: 'Cannot purchase your own track' }, { status: 400 }))
    }

    // Prevent duplicate purchase
    try {
      const dupRes = await supabaseRest(`earn_purchases?buyer_id=eq.${userId}&track_id=eq.${trackId}&select=id`)
      if (dupRes.ok) {
        const dups = await dupRes.json()
        if (dups && dups.length > 0) {
          return corsResponse(NextResponse.json({ error: 'You already own this track' }, { status: 400 }))
        }
      }
    } catch { /* table may not exist yet */ }

    // 4. Calculate cost — 5 base + optional 5 for stems
    const baseCost = 5
    const artistShare = 1
    const adminShare = 4
    const stemsCost = splitStems ? 5 : 0
    const totalCost = baseCost + stemsCost

    if ((buyer.credits || 0) < totalCost) {
      return corsResponse(NextResponse.json({ error: 'Insufficient credits' }, { status: 402 }))
    }

    // 5. Fetch artist's credits + username
    const artistRes = await supabaseRest(`users?clerk_user_id=eq.${track.user_id}&select=clerk_user_id,credits,username`)
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

    // 7. Credit artist (1 credit) and admin/444 Radio (4 credits)
    const ADMIN_CLERK_ID = process.env.ADMIN_CLERK_ID || 'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB'
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

    // Credit 444 Radio admin
    const adminRes2 = await supabaseRest(`users?clerk_user_id=eq.${ADMIN_CLERK_ID}&select=clerk_user_id,credits`)
    const admins = await adminRes2.json()
    const admin = admins?.[0]
    if (admin) {
      const newAdminCredits = (admin.credits || 0) + adminShare
      await supabaseRest(`users?clerk_user_id=eq.${ADMIN_CLERK_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ credits: newAdminCredits }),
      })
      // Log admin credit transaction
      await logCreditTransaction({ userId: ADMIN_CLERK_ID, amount: adminShare, balanceAfter: newAdminCredits, type: 'earn_admin', description: `Download fee: ${track.title}`, metadata: { trackId, buyerId: userId } })
    }

    // 8. Increment download count on track
    await supabaseRest(`combined_media?id=eq.${trackId}`, {
      method: 'PATCH',
      body: JSON.stringify({ downloads: (track.downloads || 0) + 1 }),
    })

    // 9. Record transaction + purchase record
    // Fetch buyer username for transaction record
    let buyerUsername = 'Unknown'
    try {
      const buyerInfoRes = await supabaseRest(`users?clerk_user_id=eq.${userId}&select=username`)
      if (buyerInfoRes.ok) {
        const buyerInfos = await buyerInfoRes.json()
        buyerUsername = buyerInfos?.[0]?.username || 'Unknown'
      }
    } catch { /* non-critical */ }

    let sellerUsername = 'Unknown'
    try {
      const sellerInfoRes = await supabaseRest(`users?clerk_user_id=eq.${track.user_id}&select=username`)
      if (sellerInfoRes.ok) {
        const sellerInfos = await sellerInfoRes.json()
        sellerUsername = sellerInfos?.[0]?.username || 'Unknown'
      }
    } catch { /* non-critical */ }

    try {
      await supabaseRest('earn_transactions', {
        method: 'POST',
        body: JSON.stringify({
          buyer_id: userId,
          seller_id: track.user_id,
          admin_id: admin?.clerk_user_id || null,
          track_id: trackId,
          total_cost: totalCost,
          artist_share: artistShare,
          admin_share: adminShare,
          split_stems: splitStems || false,
          buyer_username: buyerUsername,
          seller_username: sellerUsername,
          track_title: track.title,
          transaction_type: 'purchase',
        }),
      })
    } catch (e) {
      console.error('Failed to record earn transaction:', e)
    }

    // 9a. Record in earn_purchases (for re-release prevention)
    try {
      await supabaseRest('earn_purchases', {
        method: 'POST',
        body: JSON.stringify({
          buyer_id: userId,
          seller_id: track.user_id,
          track_id: trackId,
          track_title: track.title,
          amount_paid: totalCost,
        }),
      })
    } catch (e) {
      console.error('Failed to record earn purchase (table may not exist):', e)
    }

    // 9b. Log credit transactions for buyer and seller
    await logCreditTransaction({ userId, amount: -totalCost, balanceAfter: newBuyerCredits, type: 'earn_purchase', description: `Purchased: ${track.title}`, metadata: { trackId, splitStems, sellerUsername: artist?.username || 'Unknown' } })
    await logCreditTransaction({ userId: track.user_id, amount: artistShare, balanceAfter: newArtistCredits, type: 'earn_sale', description: `Sale: ${track.title}`, metadata: { trackId, buyerId: userId, buyerUsername: buyer?.username || 'Unknown' } })

    // 9c. Log 444 ownership lineage for the purchase
    try {
      await logOwnershipEvent({
        trackId,
        originalCreatorId: track.original_creator_id || track.user_id,
        currentOwnerId: userId,
        transactionType: 'purchase',
        licenseType: track.license_type_444 || 'fully_ownable',
        derivativeAllowed: track.derivative_allowed || false,
        trackId444: track.track_id_444,
        metadata: {
          buyerUsername: buyerUsername,
          price: totalCost,
          splitStems: splitStems || false,
        },
      })
      await recordDownloadLineage({
        trackId,
        downloadUserId: userId,
        originalCreatorId: track.original_creator_id || track.user_id,
        derivativeAllowed: track.derivative_allowed || false,
        remixAllowed: track.remix_allowed || false,
        licenseType: track.license_type_444 || 'download_only',
        embeddedTrackId444: track.track_id_444,
      })
    } catch (e) {
      console.error('Ownership lineage logging failed (non-critical):', e)
    }

    // 10. Save to buyer's music_library so it appears in their Library
    try {
      await supabaseRest('music_library', {
        method: 'POST',
        body: JSON.stringify({
          clerk_user_id: userId,
          title: track.title,
          audio_url: track.audio_url,
          image_url: track.image_url || null,
          genre: track.genre || null,
          prompt: `Purchased from EARN marketplace`,
          status: 'ready',
        }),
      })
    } catch (e) {
      console.error('Failed to save to buyer library (non-critical):', e)
    }

    // 11. If split stems requested, queue the job
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
      audioUrl: track.audio_url,
      title: track.title,
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
