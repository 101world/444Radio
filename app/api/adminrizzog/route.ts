import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_CLERK_ID } from '@/lib/constants'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId || userId !== ADMIN_CLERK_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = supabaseAdmin
  const { searchParams } = new URL(req.url)
  const tab = searchParams.get('tab') || 'overview'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const userFilter = searchParams.get('userId') || null
  const offset = (page - 1) * limit

  try {
    if (tab === 'overview') {
      // Parallel fetch: totals
      const [usersRes, mediaRes, txnSummaryRes, recentTxnsRes, topUsersRes, subUsersRes] = await Promise.all([
        // Total users
        supabase.from('users').select('id', { count: 'exact', head: true }),
        // Total media
        supabase.from('combined_media').select('id', { count: 'exact', head: true }),
        // Placeholder for future RPC
        Promise.resolve(null),
        // Recent transactions (last 20)
        supabase
          .from('credit_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
        // Top users by credits
        supabase
          .from('users')
          .select('*')
          .order('credits', { ascending: false })
          .limit(10),
        // Paid users (wallet_balance >= $1 = has access)
        supabase
          .from('users')
          .select('*')
          .gte('wallet_balance', 1.00)
          .order('wallet_balance', { ascending: false })
      ])

      // Debug: log paid users query result
      if (subUsersRes.error) {
        console.error('[adminrizzog] Paid users query error:', subUsersRes.error)
      }
      
      // Build paid users list: wallet_balance >= $1 OR has wallet_deposit/credit_award transactions
      let paidUsersList = subUsersRes.data || []
      
      // Also find users who deposited real money (wallet_deposit txns) but wallet_balance may be $0
      // This catches users who paid before the wallet system was deployed
      const { data: depositTxnUsers } = await supabase
        .from('credit_transactions')
        .select('user_id')
        .in('type', ['wallet_deposit'])
        .eq('status', 'success')
      
      const depositUserIds = [...new Set((depositTxnUsers || []).map((t: any) => t.user_id))]
      const existingIds = new Set(paidUsersList.map((u: any) => u.clerk_user_id))
      const missingIds = depositUserIds.filter(id => !existingIds.has(id))
      
      if (missingIds.length > 0) {
        // Fetch these users who deposited money but wallet_balance < $1
        const { data: extraPaidUsers } = await supabase
          .from('users')
          .select('*')
          .in('clerk_user_id', missingIds)
        if (extraPaidUsers && extraPaidUsers.length > 0) {
          paidUsersList = [...paidUsersList, ...extraPaidUsers]
          console.log(`[adminrizzog] Found ${extraPaidUsers.length} additional paid users from transaction history`)
        }
      }
      
      // Sort by wallet_balance descending
      paidUsersList.sort((a: any, b: any) => parseFloat(b.wallet_balance || '0') - parseFloat(a.wallet_balance || '0'))
      
      console.log(`[adminrizzog] Total paid users: ${paidUsersList.length}`, 
        paidUsersList.map((u: any) => ({ username: u.username, wallet: u.wallet_balance })))

      // Sum all credits in system
      const { data: creditSum } = await supabase
        .from('users')
        .select('credits')

      const totalCreditsInSystem = (creditSum || []).reduce((sum: number, u: { credits: number }) => sum + (u.credits || 0), 0)

      // Sum total credits ever awarded (positive transactions only)
      const { data: awardedTxns } = await supabase
        .from('credit_transactions')
        .select('amount')
        .gt('amount', 0)

      const totalCreditsAwarded = (awardedTxns || []).reduce((sum: number, t: { amount: number }) => sum + (t.amount || 0), 0)

      // Sum total credits spent (negative transactions)
      const totalCreditsSpent = Math.abs(
        ((await supabase.from('credit_transactions').select('amount').lt('amount', 0)).data || [])
          .reduce((sum: number, t: { amount: number }) => sum + (t.amount || 0), 0)
      )

      // Recent credit inflow transactions (wallet_deposit, wallet_conversion, credit_award, code_claim)
      const { data: recentAwards } = await supabase
        .from('credit_transactions')
        .select('*')
        .in('type', ['wallet_deposit', 'wallet_conversion', 'credit_award', 'code_claim', 'credit_refund'])
        .order('created_at', { ascending: false })
        .limit(50)

      // Credit purchases summary (wallet deposits = real money in)
      let creditPurchases: any[] = []
      let totalDeposited = 0
      try {
        const { data: depositTxns } = await supabase
          .from('credit_transactions')
          .select('*')
          .eq('type', 'wallet_deposit')
          .order('created_at', { ascending: false })
          .limit(50)
        creditPurchases = depositTxns || []
        totalDeposited = creditPurchases.reduce((sum: number, t: any) => {
          const meta = t.metadata || {}
          return sum + (parseFloat(meta.deposit_usd || meta.amount_usd || meta.deposit_amount || '0'))
        }, 0)
      } catch {
        // Table may not exist yet
      }

      // Count by media type
      const { data: mediaCounts } = await supabase
        .from('combined_media')
        .select('type')

      const mediaByType: Record<string, number> = {}
      for (const m of mediaCounts || []) {
        mediaByType[m.type] = (mediaByType[m.type] || 0) + 1
      }

      return NextResponse.json({
        tab: 'overview',
        totalUsers: usersRes.count || 0,
        totalMedia: mediaRes.count || 0,
        totalCreditsInSystem,
        totalCreditsAwarded,
        totalCreditsSpent,
        adminWalletTotal: 444_000_000_000,
        adminWalletRemaining: 444_000_000_000 - totalCreditsAwarded,
        mediaByType,
        topUsers: topUsersRes.data || [],
        paidUsers: paidUsersList,
        paidUsersCount: paidUsersList.length,
        recentTransactions: recentTxnsRes.data || [],
        recentAwards: recentAwards || [],
        creditPurchases,
        totalDeposited,
        totalCreditPurchases: creditPurchases.length,
      })
    }

    if (tab === 'users') {
      const { data, count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return NextResponse.json({ tab: 'users', data, total: count, page, limit })
    }

    if (tab === 'transactions') {
      let query = supabase
        .from('credit_transactions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (userFilter) {
        query = query.eq('user_id', userFilter)
      }

      const typeFilter = searchParams.get('type')
      if (typeFilter) {
        query = query.eq('type', typeFilter)
      }

      const { data, count, error } = await query
      if (error) throw error

      return NextResponse.json({ tab: 'transactions', data, total: count, page, limit })
    }

    if (tab === 'redemptions') {
      const { data, count, error } = await supabase
        .from('code_redemptions')
        .select('*', { count: 'exact' })
        .order('redeemed_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return NextResponse.json({ tab: 'redemptions', data, total: count, page, limit })
    }

    if (tab === 'generations') {
      let query = supabase
        .from('plugin_jobs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (userFilter) {
        query = query.eq('clerk_user_id', userFilter)
      }

      const { data, count, error } = await query
      if (error) throw error

      return NextResponse.json({ tab: 'generations', data, total: count, page, limit })
    }

    if (tab === 'plugin-purchases') {
      try {
        let query = supabase
          .from('plugin_purchases')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (userFilter) {
          query = query.eq('clerk_user_id', userFilter)
        }

        const statusFilter = searchParams.get('status')
        if (statusFilter) {
          query = query.eq('status', statusFilter)
        }

        const { data, count, error } = await query
        if (error) throw error

        const totalRevenue = (data || []).filter((p: any) => p.status === 'completed')
          .reduce((sum: number, p: any) => sum + ((p.amount || 0) / 100), 0) // cents → dollars

        return NextResponse.json({ tab: 'plugin-purchases', data, total: count, page, limit, totalRevenue })
      } catch (err: any) {
        // Table may not exist yet
        return NextResponse.json({ tab: 'plugin-purchases', data: [], total: 0, page, limit, totalRevenue: 0, note: 'plugin_purchases table may not exist — run migration 023' })
      }
    }

    if (tab === 'user-detail') {
      if (!userFilter) return NextResponse.json({ error: 'userId required' }, { status: 400 })

      const [userRes, txnRes, mediaRes, jobsRes, redemptionsRes] = await Promise.all([
        supabase.from('users').select('*').eq('clerk_user_id', userFilter).single(),
        supabase
          .from('credit_transactions')
          .select('*')
          .eq('user_id', userFilter)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('combined_media')
          .select('id, title, type, plays, likes, genre, created_at')
          .eq('user_id', userFilter)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('plugin_jobs')
          .select('*')
          .eq('clerk_user_id', userFilter)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('code_redemptions')
          .select('*')
          .eq('clerk_user_id', userFilter)
          .order('redeemed_at', { ascending: false })
      ])

      return NextResponse.json({
        tab: 'user-detail',
        user: userRes.data,
        transactions: txnRes.data || [],
        media: mediaRes.data || [],
        pluginJobs: jobsRes.data || [],
        redemptions: redemptionsRes.data || [],
      })
    }

    return NextResponse.json({ error: 'Invalid tab' }, { status: 400 })
  } catch (err: any) {
    console.error('[adminrizzog] Error:', JSON.stringify(err, null, 2))
    const msg = err?.message || err?.error_description || (typeof err === 'string' ? err : 'Internal error')
    return NextResponse.json({ error: msg, code: err?.code, details: err?.details, hint: err?.hint }, { status: 500 })
  }
}
