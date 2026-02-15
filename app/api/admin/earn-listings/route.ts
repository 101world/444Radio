/**
 * Admin Earn Listings API
 * GET /api/admin/earn-listings — Lists all tracks listed on Earn marketplace with user info + transactions
 *
 * Protected: only allows ADMIN_USER_ID.
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { ADMIN_CLERK_ID as ADMIN_USER_ID } from '@/lib/constants'

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

export async function GET() {
  const { userId } = await auth()
  if (userId !== ADMIN_USER_ID) {
    return corsResponse(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  try {
    // 1. Fetch all listed tracks
    const listedRes = await supabaseRest(
      'combined_media?listed_on_earn=eq.true&order=created_at.desc&select=id,title,user_id,type,genre,artist_name,listed_on_earn,earn_price,artist_share,admin_share,downloads,created_at,image_url,plays'
    )
    const listedTracks = await listedRes.json()

    if (!Array.isArray(listedTracks)) {
      return corsResponse(NextResponse.json({ listings: [], stats: {}, transactions: [] }))
    }

    // 2. Fetch all unique user IDs to enrich with usernames
    const userIds = [...new Set(listedTracks.map((t: any) => t.user_id))]
    let userMap: Record<string, any> = {}
    if (userIds.length > 0) {
      const usersRes = await supabaseRest(
        `users?clerk_user_id=in.(${userIds.join(',')}')&select=clerk_user_id,username,email,credits,subscription_status,subscription_plan`
      )
      if (usersRes.ok) {
        const users = await usersRes.json()
        if (Array.isArray(users)) {
          for (const u of users) {
            userMap[u.clerk_user_id] = u
          }
        }
      }
    }

    // 3. Fetch earn_transactions (all listing fees + purchases)
    const txRes = await supabaseRest(
      'earn_transactions?order=created_at.desc&limit=200&select=id,buyer_id,seller_id,admin_id,track_id,total_cost,artist_share,admin_share,split_stems,created_at,buyer_username,seller_username,track_title,transaction_type'
    )
    let transactions: any[] = []
    if (txRes.ok) {
      const txData = await txRes.json()
      if (Array.isArray(txData)) {
        transactions = txData
      }
    }

    // 4. Fetch credit_transactions for listing fees
    const listingTxRes = await supabaseRest(
      'credit_transactions?type=in.(earn_list,earn_admin)&order=created_at.desc&limit=200&select=id,user_id,amount,balance_after,type,description,metadata,created_at'
    )
    let listingFees: any[] = []
    if (listingTxRes.ok) {
      const ltData = await listingTxRes.json()
      if (Array.isArray(ltData)) {
        listingFees = ltData
      }
    }

    // 5. Compute stats
    const totalListed = listedTracks.length
    const totalDownloads = listedTracks.reduce((sum: number, t: any) => sum + (t.downloads || 0), 0)
    const totalListingFees = listingFees.filter((f: any) => f.type === 'earn_list').length * 2
    const totalAdminRevenue = listingFees
      .filter((f: any) => f.type === 'earn_admin')
      .reduce((sum: number, f: any) => sum + (f.amount || 0), 0)
    const totalPurchases = transactions.filter((t: any) => t.transaction_type === 'purchase' || !t.transaction_type).length
    const uniqueListers = new Set(listedTracks.map((t: any) => t.user_id)).size

    // Enrich listings with user info
    const enrichedListings = listedTracks.map((track: any) => ({
      ...track,
      user: userMap[track.user_id] || null,
    }))

    // Enrich transactions with user info
    const enrichedTransactions = transactions.map((tx: any) => ({
      ...tx,
      buyer: userMap[tx.buyer_id] || null,
      seller: userMap[tx.seller_id] || null,
    }))

    return corsResponse(NextResponse.json({
      listings: enrichedListings,
      transactions: enrichedTransactions,
      listingFees,
      stats: {
        totalListed,
        totalDownloads,
        totalListingFees,
        totalAdminRevenue,
        totalPurchases,
        uniqueListers,
      },
    }))
  } catch (error: any) {
    console.error('Admin earn listings error:', error?.message || error)
    return corsResponse(NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 }))
  }
}
