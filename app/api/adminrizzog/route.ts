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

  console.log(`[adminrizzog] GET request: tab=${tab}, page=${page}, limit=${limit}, userId=${userFilter}`)

  try {
    // Handle new analytics/activity/sessions/credits-by-model tabs by direct implementation
    if (tab === 'analytics' || tab === 'activity' || tab === 'sessions' || tab === 'credits-by-model') {
      console.log(`[adminrizzog] Handling tab: ${tab}`)
      
      // Map tab to analytics type
      const analyticsType = tab === 'activity' ? 'activity-feed' : tab
      
      // Call analytics API route logic inline to avoid fetch issues
      try {
        if (analyticsType === 'analytics') {
          // Get comprehensive analytics overview
          const [usersCount, mediaCount, generationsCount, txnData] = await Promise.all([
            supabase.from('users').select('id', { count: 'exact', head: true }),
            supabase.from('combined_media').select('id', { count: 'exact', head: true }),
            supabase.from('plugin_jobs').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
            supabase.from('credit_transactions').select('*').order('created_at', { ascending: false }).limit(100)
          ])
          
          console.log(`[adminrizzog] Analytics data: ${usersCount.count} users, ${mediaCount.count} media, ${generationsCount.count} generations`)
          
          return NextResponse.json({
            type: 'analytics',
            tab: 'analytics',
            totalUsers: usersCount.count || 0,
            totalMedia: mediaCount.count || 0,
            totalGenerations: generationsCount.count || 0,
            recentTransactions: txnData.data || [],
            charts: []
          })
        }
        
        if (analyticsType === 'activity-feed') {
          // Get recent activity feed with user info
          const { data: activityData, error: activityError } = await supabase
            .from('activity_logs')
            .select(`
              *,
              user:users!activity_logs_user_id_fkey(
                clerk_user_id,
                username,
                email
              )
            `)
            .order('created_at', { ascending: false })
            .limit(parseInt(searchParams.get('limit') || '50'))
          
          if (activityError) {
            console.error('[adminrizzog] Activity feed error:', activityError)
            // Return empty if table doesn't exist yet
            return NextResponse.json({
              type: 'activity-feed',
              tab: 'activity',
              activities: [],
              note: 'activity_logs table may not exist yet'
            })
          }
          
          console.log(`[adminrizzog] Activity feed: ${activityData?.length || 0} activities`)
          
          return NextResponse.json({
            type: 'activity-feed',
            tab: 'activity',
            activities: activityData || []
          })
        }
        
        if (analyticsType === 'sessions') {
          // Get active sessions
          const { data: sessionData, error: sessionError } = await supabase
            .from('user_sessions')
            .select('*')
            .order('last_active', { ascending: false })
            .limit(50)
          
          if (sessionError) {
            console.error('[adminrizzog] Sessions error:', sessionError)
            // Return empty if table doesn't exist
            return NextResponse.json({
              type: 'sessions',
              tab: 'sessions',
              activeSessions: [],
              deviceStats: {},
              browserStats: {},
              note: 'user_sessions table may not exist yet'
            })
          }
          
          // Calculate device and browser stats
          const deviceStats: Record<string, number> = {}
          const browserStats: Record<string, number> = {}
          
          for (const session of sessionData || []) {
            const device = session.device_type || 'unknown'
            const browser = session.browser || 'unknown'
            deviceStats[device] = (deviceStats[device] || 0) + 1
            browserStats[browser] = (browserStats[browser] || 0) + 1
          }
          
          console.log(`[adminrizzog] Sessions: ${sessionData?.length || 0} active`)
          
          return NextResponse.json({
            type: 'sessions',
            tab: 'sessions',
            activeSessions: sessionData || [],
            deviceStats,
            browserStats
          })
        }
        
        if (analyticsType === 'credits-by-model') {
          // Comprehensive credits-by-model analytics with ALL historic data
          console.log('[adminrizzog] Fetching comprehensive credits-by-model analytics...')
          
          // Fetch ALL plugin jobs (completed AND failed to show full history)
          const { data: allJobs, error: jobsError } = await supabase
            .from('plugin_jobs')
            .select(`
              id,
              clerk_user_id,
              type,
              status,
              credits_cost,
              params,
              created_at,
              completed_at
            `)
            .order('created_at', { ascending: false })
          
          if (jobsError) {
            console.error('[adminrizzog] Error fetching plugin_jobs:', jobsError)
            throw new Error(`Failed to fetch plugin jobs: ${jobsError.message}`)
          }
          
          // Fetch user info for all jobs
          const userIds = [...new Set((allJobs || []).map(j => j.clerk_user_id))]
          const { data: users } = await supabase
            .from('users')
            .select('clerk_user_id, username, email')
            .in('clerk_user_id', userIds)
          
          const userMap = new Map((users || []).map(u => [u.clerk_user_id, u]))
          
          // Fetch all generation credit transactions for cross-reference
          const { data: genTxns } = await supabase
            .from('credit_transactions')
            .select('id, user_id, type, amount, status, created_at, metadata')
            .like('type', 'generation_%')
            .order('created_at', { ascending: false })
          
          console.log(`[adminrizzog] Found ${allJobs?.length || 0} plugin jobs, ${users?.length || 0} users, ${genTxns?.length || 0} generation transactions`)
          
          // Build comprehensive model statistics
          interface ModelStats {
            name: string
            plugin: string
            runs: number
            completedRuns: number
            failedRuns: number
            credits: number
            avgCreditsPerRun: number
            users: Array<{
              userId: string
              username: string
              email: string
              runs: number
              credits: number
              lastRun: string
            }>
          }
          
          const modelStatsMap = new Map<string, ModelStats>()
          
          // Process each job
          for (const job of allJobs || []) {
            const modelType = job.type || 'unknown'
            const user = userMap.get(job.clerk_user_id)
            
            if (!modelStatsMap.has(modelType)) {
              modelStatsMap.set(modelType, {
                name: modelType.charAt(0).toUpperCase() + modelType.slice(1).replace(/_/g, ' '),
                plugin: modelType,
                runs: 0,
                completedRuns: 0,
                failedRuns: 0,
                credits: 0,
                avgCreditsPerRun: 0,
                users: []
              })
            }
            
            const stats = modelStatsMap.get(modelType)!
            stats.runs++
            
            if (job.status === 'completed') {
              stats.completedRuns++
              stats.credits += job.credits_cost || 0
            } else if (job.status === 'failed' || job.status === 'cancelled') {
              stats.failedRuns++
              // Note: Failed jobs may have been refunded, don't count credits
            }
            
            // Find or create user entry in this model's stats
            let userStats = stats.users.find(u => u.userId === job.clerk_user_id)
            if (!userStats) {
              userStats = {
                userId: job.clerk_user_id,
                username: user?.username || 'Unknown',
                email: user?.email || 'N/A',
                runs: 0,
                credits: 0,
                lastRun: job.created_at
              }
              stats.users.push(userStats)
            }
            
            userStats.runs++
            if (job.status === 'completed') {
              userStats.credits += job.credits_cost || 0
            }
            if (new Date(job.created_at) > new Date(userStats.lastRun)) {
              userStats.lastRun = job.created_at
            }
          }
          
          // Calculate averages and sort users
          const models = Array.from(modelStatsMap.values())
          for (const model of models) {
            model.avgCreditsPerRun = model.completedRuns > 0 
              ? Math.round(model.credits / model.completedRuns) 
              : 0
            // Sort users by credits desc
            model.users.sort((a, b) => b.credits - a.credits)
          }
          
          // Sort models by total credits desc
          models.sort((a, b) => b.credits - a.credits)
          
          const totalCredits = models.reduce((sum, m) => sum + m.credits, 0)
          const totalRuns = models.reduce((sum, m) => sum + m.runs, 0)
          
          // Credit transaction summary for verification
          const txnCredits = (genTxns || [])
            .filter(t => t.status === 'success')
            .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0)
          
          console.log(`[adminrizzog] ✅ Credits by model: ${models.length} models, ${totalRuns} total runs, ${totalCredits} credits from jobs, ${txnCredits} from transactions`)
          
          return NextResponse.json({
            type: 'credits-by-model',
            tab: 'credits-by-model',
            models,
            totalCredits,
            totalRuns,
            uniqueUsers: userIds.length,
            creditTransactionTotal: txnCredits,
            mismatch: Math.abs(totalCredits - txnCredits),
            generatedAt: new Date().toISOString()
          })
        }
        
        // If no matching analytics type, return error
        console.error(`[adminrizzog] Unknown analytics type: ${analyticsType}`)
        return NextResponse.json({ 
          error: `Unknown analytics type: ${analyticsType}`,
          tab 
        }, { status: 400 })
        
      } catch (analyticsError) {
        console.error('[adminrizzog] Analytics error:', analyticsError)
        const errMsg = (analyticsError as any)?.message || 'Unknown error'
        const analyticsType = tab === 'activity' ? 'activity-feed' : tab
        return NextResponse.json({ 
          error: 'Analytics data unavailable', 
          details: errMsg,
          tab,
          type: analyticsType 
        }, { status: 500 })
      }
    }

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

    console.error(`[adminrizzog] Invalid tab requested: ${tab}`)
    return NextResponse.json({ error: `Invalid tab: ${tab}` }, { status: 400 })
  } catch (err: any) {
    console.error('[adminrizzog] Error:', JSON.stringify(err, null, 2))
    const msg = err?.message || err?.error_description || (typeof err === 'string' ? err : 'Internal error')
    return NextResponse.json({ error: msg, code: err?.code, details: err?.details, hint: err?.hint, tab }, { status: 500 })
  }
}
