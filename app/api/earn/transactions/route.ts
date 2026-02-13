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
 * GET /api/earn/transactions
 * Returns the current user's sales (tracks they sold) and purchases (tracks they bought).
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all' // 'sales' | 'purchases' | 'all'

    const sales: any[] = []
    const purchases: any[] = []

    // Fetch sales (where I am the seller)
    if (type === 'all' || type === 'sales') {
      const salesRes = await supabaseRest(
        `earn_transactions?seller_id=eq.${userId}&order=created_at.desc&limit=100&select=id,buyer_id,seller_id,track_id,total_cost,artist_share,admin_share,split_stems,created_at,buyer_username,track_title,transaction_type`
      )
      if (salesRes.ok) {
        const rawSales = await salesRes.json()
        // Enrich with buyer usernames if not already stored
        const buyerIds = [...new Set(rawSales.filter((s: any) => !s.buyer_username).map((s: any) => s.buyer_id))]
        let buyerMap = new Map<string, string>()
        if (buyerIds.length > 0) {
          const usersRes = await supabaseRest(`users?clerk_user_id=in.(${buyerIds.join(',')})&select=clerk_user_id,username`)
          if (usersRes.ok) {
            const users = await usersRes.json()
            buyerMap = new Map(users.map((u: any) => [u.clerk_user_id, u.username]))
          }
        }

        // Enrich with track titles if not stored
        const trackIds = [...new Set(rawSales.filter((s: any) => !s.track_title).map((s: any) => s.track_id))]
        let trackMap = new Map<string, string>()
        if (trackIds.length > 0) {
          const tracksRes = await supabaseRest(`combined_media?id=in.(${trackIds.join(',')})&select=id,title`)
          if (tracksRes.ok) {
            const tracks = await tracksRes.json()
            trackMap = new Map(tracks.map((t: any) => [t.id, t.title]))
          }
        }

        for (const s of rawSales) {
          // Skip listing fees (those aren't sales to human buyers)
          if (s.transaction_type === 'listing') continue
          sales.push({
            id: s.id,
            buyer_username: s.buyer_username || buyerMap.get(s.buyer_id) || 'Unknown',
            buyer_id: s.buyer_id,
            track_title: s.track_title || trackMap.get(s.track_id) || 'Unknown Track',
            track_id: s.track_id,
            credits_earned: s.artist_share || 1,
            total_cost: s.total_cost,
            split_stems: s.split_stems,
            created_at: s.created_at,
          })
        }
      }
    }

    // Fetch purchases (where I am the buyer)
    if (type === 'all' || type === 'purchases') {
      const purchasesRes = await supabaseRest(
        `earn_transactions?buyer_id=eq.${userId}&order=created_at.desc&limit=100&select=id,buyer_id,seller_id,track_id,total_cost,artist_share,admin_share,split_stems,created_at,seller_username,track_title,transaction_type`
      )
      if (purchasesRes.ok) {
        const rawPurchases = await purchasesRes.json()
        // Enrich with seller usernames
        const sellerIds = [...new Set(rawPurchases.filter((p: any) => !p.seller_username).map((p: any) => p.seller_id))]
        let sellerMap = new Map<string, string>()
        if (sellerIds.length > 0) {
          const usersRes = await supabaseRest(`users?clerk_user_id=in.(${sellerIds.join(',')})&select=clerk_user_id,username`)
          if (usersRes.ok) {
            const users = await usersRes.json()
            sellerMap = new Map(users.map((u: any) => [u.clerk_user_id, u.username]))
          }
        }

        const trackIds = [...new Set(rawPurchases.filter((p: any) => !p.track_title).map((p: any) => p.track_id))]
        let trackMap = new Map<string, string>()
        if (trackIds.length > 0) {
          const tracksRes = await supabaseRest(`combined_media?id=in.(${trackIds.join(',')})&select=id,title`)
          if (tracksRes.ok) {
            const tracks = await tracksRes.json()
            trackMap = new Map(tracks.map((t: any) => [t.id, t.title]))
          }
        }

        for (const p of rawPurchases) {
          purchases.push({
            id: p.id,
            seller_username: p.seller_username || sellerMap.get(p.seller_id) || 'Unknown',
            seller_id: p.seller_id,
            track_title: p.track_title || trackMap.get(p.track_id) || 'Unknown Track',
            track_id: p.track_id,
            credits_spent: p.total_cost,
            split_stems: p.split_stems,
            type: p.transaction_type || 'purchase',
            created_at: p.created_at,
          })
        }
      }
    }

    return corsResponse(NextResponse.json({
      success: true,
      sales,
      purchases,
      totalEarned: sales.reduce((s, tx) => s + (tx.credits_earned || 0), 0),
      totalSpent: purchases.reduce((s, tx) => s + (tx.credits_spent || 0), 0),
    }))

  } catch (error) {
    console.error('Transactions fetch error:', error)
    return corsResponse(NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 }))
  }
}
