import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { logOwnershipEvent, recordDownloadLineage } from '@/lib/ownership-engine'
import { ADMIN_CLERK_ID } from '@/lib/constants'
import { notifyPurchase, notifyRevenueEarned } from '@/lib/notifications'

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
 *   - Users with $1+ wallet balance can purchase.
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

    // 1. Fetch buyer — need credits + username
    const buyerRes = await supabaseRest(`users?clerk_user_id=eq.${userId}&select=clerk_user_id,credits,username`)
    const buyers = await buyerRes.json()
    const buyer = buyers?.[0]

    if (!buyer) {
      return corsResponse(NextResponse.json({ error: 'User not found' }, { status: 404 }))
    }

    // 2. Fetch track details (include image_url + metadata for library save)
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
    const stemsCost = splitStems ? 1 : 0
    const totalCost = baseCost + stemsCost

    // 5. Atomically deduct credits from buyer via RPC (prevents race conditions)
    const deductRes = await supabaseRest('rpc/deduct_credits', {
      method: 'POST',
      body: JSON.stringify({
        p_clerk_user_id: userId,
        p_amount: totalCost,
        p_type: 'earn_purchase',
        p_description: `Purchased: ${track.title}`,
        p_metadata: { trackId, splitStems },
      }),
    })
    if (!deductRes.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 }))
    }
    const deductRows = await deductRes.json()
    const deductRow = deductRows?.[0]
    if (!deductRow?.success) {
      const msg = deductRow?.error_message || 'Insufficient credits'
      return corsResponse(NextResponse.json({ error: msg === 'Insufficient credits' ? 'Insufficient credits' : msg }, { status: msg.includes('Insufficient') ? 402 : 500 }))
    }
    const newBuyerCredits = deductRow.new_credits

    // 6. Fetch artist's credits + username
    const artistRes = await supabaseRest(`users?clerk_user_id=eq.${track.user_id}&select=clerk_user_id,credits,username`)
    const artists = await artistRes.json()
    const artist = artists?.[0]

    // Fetch buyer username early (needed for transaction logs)
    let buyerUsername = 'Unknown'
    try {
      const buyerInfoRes = await supabaseRest(`users?clerk_user_id=eq.${userId}&select=username`)
      if (buyerInfoRes.ok) {
        const buyerInfos = await buyerInfoRes.json()
        buyerUsername = buyerInfos?.[0]?.username || 'Unknown'
      }
    } catch { /* fallback to Unknown */ }

    // Log buyer's deduction
    await logCreditTransaction({ userId, amount: -totalCost, balanceAfter: newBuyerCredits, type: 'earn_purchase', description: `Purchased: ${track.title}${splitStems ? ' (with stems)' : ''}`, metadata: { trackId, trackTitle: track.title, splitStems, baseCost, stemsCost, totalCost, sellerUsername: artist?.username || 'Unknown', sellerId: track.user_id } })

    if (!artist) {
      // Refund buyer — add credits back
      await supabaseRest(`users?clerk_user_id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ credits: newBuyerCredits + totalCost }),
      })
      return corsResponse(NextResponse.json({ error: 'Artist account not found' }, { status: 500 }))
    }

    // 7. Credit artist (1 credit) and admin/444 Radio (4 credits)
    const newArtistCredits = (artist.credits || 0) + artistShare
    const creditArtistRes = await supabaseRest(`users?clerk_user_id=eq.${track.user_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ credits: newArtistCredits }),
    })

    if (!creditArtistRes.ok) {
      // Rollback buyer deduction — add credits back
      await supabaseRest(`users?clerk_user_id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ credits: newBuyerCredits + totalCost }),
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
      await logCreditTransaction({ userId: ADMIN_CLERK_ID, amount: adminShare, balanceAfter: newAdminCredits, type: 'earn_admin', description: `Download fee: ${track.title}`, metadata: { trackId, trackTitle: track.title, buyerId: userId, buyerUsername, sellerId: track.user_id, sellerUsername: artist?.username || 'Unknown' } })
    }

    // 8. Increment download count on track
    await supabaseRest(`combined_media?id=eq.${trackId}`, {
      method: 'PATCH',
      body: JSON.stringify({ downloads: (track.downloads || 0) + 1 }),
    })

    // 9. Record transaction + purchase record
    const sellerUsername = artist?.username || 'Unknown'

    // earn_transactions insert — use base columns only, then try extra columns separately
    try {
      const txBase: Record<string, unknown> = {
        buyer_id: userId,
        seller_id: track.user_id,
        admin_id: admin?.clerk_user_id || null,
        track_id: trackId,
        total_cost: totalCost,
        artist_share: artistShare,
        admin_share: adminShare,
        split_stems: splitStems || false,
      }
      // Try with extended columns first (migration 1013)
      let txRes = await supabaseRest('earn_transactions', {
        method: 'POST',
        body: JSON.stringify({
          ...txBase,
          buyer_username: buyerUsername,
          seller_username: sellerUsername,
          track_title: track.title,
          transaction_type: 'purchase',
        }),
      })
      if (!txRes.ok) {
        // Fallback: use base columns only (extra columns may not exist yet)
        console.warn('earn_transactions extended INSERT failed, trying base columns only')
        txRes = await supabaseRest('earn_transactions', {
          method: 'POST',
          body: JSON.stringify(txBase),
        })
        if (!txRes.ok) {
          const errBody = await txRes.text().catch(() => 'unknown')
          console.error('earn_transactions INSERT failed even with base columns:', txRes.status, errBody)
        }
      }
    } catch (e) {
      console.error('earn_transactions network error:', e)
    }

    // 9a. Record in earn_purchases (for re-release prevention + bought tab)
    try {
      const purchaseInsertRes = await supabaseRest('earn_purchases', {
        method: 'POST',
        body: JSON.stringify({
          buyer_id: userId,
          seller_id: track.user_id,
          track_id: trackId,
          track_title: track.title,
          amount_paid: totalCost,
        }),
      })
      if (!purchaseInsertRes.ok) {
        const errBody = await purchaseInsertRes.text().catch(() => 'unknown')
        console.error('earn_purchases INSERT failed:', purchaseInsertRes.status, errBody)
      } else {
        console.log('✅ earn_purchases recorded for buyer', userId, 'track', trackId)
      }
    } catch (e) {
      console.error('earn_purchases network error:', e)
    }

    // 9b. Log credit transactions (buyer already logged atomically by deduct_credits RPC)
    await logCreditTransaction({ userId: track.user_id, amount: artistShare, balanceAfter: newArtistCredits, type: 'earn_sale', description: `Sale: ${track.title}`, metadata: { trackId, trackTitle: track.title, buyerId: userId, buyerUsername, purchasedAt: new Date().toISOString() } })

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
    //     NOTE: music_library table does NOT have image_url or genre columns
    try {
      const libRes = await supabaseRest('music_library', {
        method: 'POST',
        body: JSON.stringify({
          clerk_user_id: userId,
          title: track.title,
          audio_url: track.audio_url,
          prompt: `Purchased from EARN marketplace | seller:${track.user_id} | track:${trackId}`,
          status: 'ready',
        }),
      })
      if (!libRes.ok) {
        const errBody = await libRes.text().catch(() => 'unknown')
        console.error('music_library INSERT failed:', libRes.status, errBody)
      } else {
        console.log('✅ music_library saved for buyer', userId)
      }
    } catch (e) {
      console.error('music_library network error:', e)
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

    // Notify seller about the purchase (they earned revenue)
    await notifyRevenueEarned(
      track.user_id,
      artistShare,
      'track purchase',
      { trackId, trackTitle: track.title, buyerId: userId, buyerUsername }
    )

    // Notify seller with more details
    await notifyPurchase(
      track.user_id,
      userId,
      trackId,
      totalCost,
      track.title
    )

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
