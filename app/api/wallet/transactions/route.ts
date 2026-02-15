import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/wallet/transactions
 *
 * Returns paginated credit transaction history for the authenticated user.
 *
 * Query params:
 *   page   – 1-based page number (default 1)
 *   limit  – items per page (default 20, max 100)
 *   type   – optional filter by transaction type
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseKey) {
    console.error('⚠️ wallet/transactions: missing env vars', { url: !!supabaseUrl, key: !!supabaseKey })
    return corsResponse(NextResponse.json({ error: 'Server configuration error' }, { status: 500 }))
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const typeFilter = searchParams.get('type') || ''

  const offset = (page - 1) * limit

  try {
    // Build query
    let queryPath = `credit_transactions?user_id=eq.${userId}&order=created_at.desc&offset=${offset}&limit=${limit}`
    if (typeFilter) {
      // "awards" is a compound filter covering all credit income types
      if (typeFilter === 'awards') {
        queryPath += `&type=in.(credit_award,wallet_deposit,wallet_conversion,code_claim,plugin_purchase)`
      } else {
        queryPath += `&type=eq.${typeFilter}`
      }
    }

    // Fetch transactions + total count (Prefer: count=exact)
    const res = await fetch(`${supabaseUrl}/rest/v1/${queryPath}`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Range-Unit': 'items',
        'Range': `${offset}-${offset + limit - 1}`,
        'Prefer': 'count=exact',
      },
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      console.error('Wallet transactions fetch failed:', text)
      return corsResponse(NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 }))
    }

    const transactions = await res.json()
    const totalCount = parseInt(res.headers.get('content-range')?.split('/')[1] || '0', 10)

    // Enrich earn_sale / earn_purchase transactions with buyer/seller usernames
    // Collect user IDs that need username lookups
    const userIdsToLookup = new Set<string>()
    for (const tx of transactions) {
      if (tx.type === 'earn_sale' && tx.metadata?.buyerId && !tx.metadata?.buyerUsername) {
        userIdsToLookup.add(tx.metadata.buyerId)
      }
      if (tx.type === 'earn_purchase' && !tx.metadata?.sellerUsername) {
        // For purchases, we need to find the seller from earn_purchases table
        // We'll handle this below
      }
    }

    // Batch lookup usernames for buyer IDs
    const usernameMap: Record<string, string> = {}
    if (userIdsToLookup.size > 0) {
      const idsArray = Array.from(userIdsToLookup)
      const lookupRes = await fetch(
        `${supabaseUrl}/rest/v1/users?clerk_user_id=in.(${idsArray.join(',')})&select=clerk_user_id,username`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      )
      if (lookupRes.ok) {
        const lookupUsers = await lookupRes.json()
        for (const u of lookupUsers) {
          if (u.clerk_user_id && u.username) usernameMap[u.clerk_user_id] = u.username
        }
      }
    }

    // For earn_purchase transactions, look up the seller via earn_purchases table
    const purchaseTxTrackIds: string[] = []
    for (const tx of transactions) {
      if (tx.type === 'earn_purchase' && tx.metadata?.trackId && !tx.metadata?.sellerUsername) {
        purchaseTxTrackIds.push(tx.metadata.trackId)
      }
    }

    const sellerMap: Record<string, { sellerId: string; sellerUsername?: string }> = {}
    if (purchaseTxTrackIds.length > 0) {
      const trackIdsStr = purchaseTxTrackIds.map(id => `"${id}"`).join(',')
      const epRes = await fetch(
        `${supabaseUrl}/rest/v1/earn_purchases?buyer_id=eq.${userId}&track_id=in.(${trackIdsStr})&select=track_id,seller_id`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      )
      if (epRes.ok) {
        const purchases = await epRes.json()
        const sellerIds = new Set<string>()
        for (const p of purchases) {
          sellerMap[p.track_id] = { sellerId: p.seller_id }
          sellerIds.add(p.seller_id)
        }
        // Batch lookup seller usernames
        if (sellerIds.size > 0) {
          const sellerLookupRes = await fetch(
            `${supabaseUrl}/rest/v1/users?clerk_user_id=in.(${Array.from(sellerIds).join(',')})&select=clerk_user_id,username`,
            { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
          )
          if (sellerLookupRes.ok) {
            const sellerUsers = await sellerLookupRes.json()
            for (const u of sellerUsers) {
              for (const [trackId, info] of Object.entries(sellerMap)) {
                if (info.sellerId === u.clerk_user_id) {
                  sellerMap[trackId].sellerUsername = u.username
                }
              }
            }
          }
        }
      }
    }

    // Enrich transaction metadata with looked-up usernames
    for (const tx of transactions) {
      if (!tx.metadata) tx.metadata = {}
      if (tx.type === 'earn_sale' && tx.metadata.buyerId && !tx.metadata.buyerUsername) {
        tx.metadata.buyerUsername = usernameMap[tx.metadata.buyerId] || null
      }
      if (tx.type === 'earn_purchase' && tx.metadata.trackId && !tx.metadata.sellerUsername) {
        const seller = sellerMap[tx.metadata.trackId]
        if (seller?.sellerUsername) tx.metadata.sellerUsername = seller.sellerUsername
      }
    }

    // Also fetch current credit balance
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,total_generated`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    )
    const users = userRes.ok ? await userRes.json() : []
    const user = users?.[0]

    return corsResponse(NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      credits: user?.credits ?? 0,
      totalGenerated: user?.total_generated ?? 0,
    }))
  } catch (error) {
    console.error('Wallet transactions error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
