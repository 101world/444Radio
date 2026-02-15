import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const ADMIN_CLERK_ID = process.env.ADMIN_CLERK_ID || 'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB'

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
        // Active subscribers
        supabase
          .from('users')
          .select('*')
          .neq('subscription_status', 'none')
          .order('subscription_start', { ascending: false })
      ])

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

      // Recent credit inflow transactions (subscription_bonus, credit_award, code_claim, plugin_purchase)
      const { data: recentAwards } = await supabase
        .from('credit_transactions')
        .select('*')
        .in('type', ['subscription_bonus', 'credit_award', 'code_claim', 'credit_refund', 'plugin_purchase'])
        .order('created_at', { ascending: false })
        .limit(50)

      // Plugin purchases summary (graceful if table doesn't exist yet)
      let pluginPurchases: any[] = []
      let pluginRevenue = 0
      try {
        const { data: ppData } = await supabase
          .from('plugin_purchases')
          .select('*')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(50)
        pluginPurchases = ppData || []
        pluginRevenue = pluginPurchases.reduce((sum: number, p: any) => sum + ((p.amount || 0) / 100), 0) // cents → dollars
      } catch {
        // Table may not exist yet (migration 023)
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
        subscribers: subUsersRes.data || [],
        recentTransactions: recentTxnsRes.data || [],
        recentAwards: recentAwards || [],
        pluginPurchases,
        pluginRevenue,
        totalPluginPurchases: pluginPurchases.length,
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
