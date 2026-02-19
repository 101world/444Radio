/**
 * 444Radio - Admin Analytics API
 * 
 * Provides comprehensive analytics data for admin dashboard:
 * - User engagement metrics (DAU/WAU/MAU)
 * - Content performance
 * - Revenue analytics
 * - Generation statistics
 * - Activity trends
 * 
 * Route: /api/adminrizzog/analytics
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_CLERK_ID } from '@/lib/constants'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId || userId !== ADMIN_CLERK_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'overview'
  const days = parseInt(searchParams.get('days') || '30')

  try {
    const supabase = supabaseAdmin

    if (type === 'overview') {
      // Fetch all key metrics in parallel
      const [
        usersCount,
        mediaCount,
        playsCount,
        likesCount,
        generationsCount,
        revenueSum,
        newUsersToday,
        newUsersWeek,
        newUsersMonth
      ] = await Promise.all([
        // Total users
        supabase.from('users').select('id', { count: 'exact', head: true }),
        
        // Total media
        supabase.from('combined_media').select('id', { count: 'exact', head: true }),
        
        // Total plays
        supabase.from('combined_media').select('plays'),
        
        // Total likes
        supabase.from('user_likes').select('id', { count: 'exact', head: true }),
        
        // Total generations (from plugin_jobs completed)
        supabase.from('plugin_jobs').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        
        // Total revenue (wallet deposits)
        supabase.from('credit_transactions')
          .select('metadata')
          .eq('type', 'wallet_deposit')
          .eq('status', 'success'),
        
        // New users today
        supabase.from('users')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        
        // New users this week
        supabase.from('users')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        
        // New users this month
        supabase.from('users')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      ])

      // Try to get active users (will fail gracefully if function doesn't exist yet)
      let activeToday = 0
      let activeWeek = 0
      let activeMonth = 0
      
      try {
        const { data: todayData } = await supabase.rpc('get_active_users_count', { minutes: 1440 })
        activeToday = todayData || 0
      } catch (err) {
        // Function not yet available - migrations not run
      }
      
      try {
        const { data: weekData } = await supabase.rpc('get_active_users_count', { minutes: 10080 })
        activeWeek = weekData || 0
      } catch (err) {
        // Function not yet available - migrations not run
      }
      
      try {
        const { data: monthData } = await supabase.rpc('get_active_users_count', { minutes: 43200 })
        activeMonth = monthData || 0
      } catch (err) {
        // Function not yet available - migrations not run
      }

      // Calculate totals
      const totalPlays = (playsCount.data || []).reduce((sum: number, m: any) => sum + (m.plays || 0), 0)
      const totalRevenue = (revenueSum.data || []).reduce((sum: number, t: any) => {
        const meta = t.metadata as any
        return sum + parseFloat(meta?.deposit_usd || meta?.amount_usd || '0')
      }, 0)

      return NextResponse.json({
        type: 'overview',
        totalUsers: usersCount.count || 0,
        totalMedia: mediaCount.count || 0,
        totalPlays,
        totalLikes: likesCount.count || 0,
        totalGenerations: generationsCount.count || 0,
        totalRevenue,
        activeUsers: {
          today: activeToday,
          week: activeWeek,
          month: activeMonth
        },
        newUsers: {
          today: newUsersToday.count || 0,
          week: newUsersWeek.count || 0,
          month: newUsersMonth.count || 0
        }
      })
    }

    if (type === 'engagement') {
      // User engagement analytics over time
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      
      // Daily active users (from activity_logs)
      const { data: dailyActivity } = await supabase
        .from('activity_logs')
        .select('user_id, created_at')
        .gte('created_at', startDate)
      
      // Group by date
      const dailyActiveUsers: Record<string, Set<string>> = {}
      for (const activity of dailyActivity || []) {
        const date = new Date(activity.created_at).toISOString().split('T')[0]
        if (!dailyActiveUsers[date]) dailyActiveUsers[date] = new Set()
        dailyActiveUsers[date].add(activity.user_id)
      }
      
      const dailyData = Object.entries(dailyActiveUsers).map(([date, users]) => ({
        date,
        activeUsers: users.size
      })).sort((a, b) => a.date.localeCompare(b.date))
      
      // User retention (users who returned after Day 1, Day 7, Day 30)
      const { data: allUsers } = await supabase
        .from('users')
        .select('clerk_user_id, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      
      return NextResponse.json({
        type: 'engagement',
        dailyActiveUsers: dailyData,
        totalUsers: allUsers?.length || 0
      })
    }

    if (type === 'content') {
      // Content performance analytics
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      
      const [
        trendingTracks,
        topLikedTracks,
        contentByDate,
        playsByDate
      ] = await Promise.all([
        // Trending tracks (most plays recently)
        supabase
          .from('combined_media')
          .select('id, title, user_id, plays, likes, created_at')
          .gte('created_at', startDate)
          .order('plays', { ascending: false })
          .limit(10),
        
        // Top liked tracks
        supabase
          .from('combined_media')
          .select('id, title, user_id, plays, likes, created_at')
          .order('likes', { ascending: false })
          .limit(10),
        
        // Content uploads by date
        supabase
          .from('combined_media')
          .select('id, created_at')
          .gte('created_at', startDate),
        
        // Plays by date (from activity_logs)
        supabase
          .from('activity_logs')
          .select('created_at')
          .eq('action_type', 'play')
          .gte('created_at', startDate)
      ])
      
      // Group content uploads by date
      const uploadsByDate: Record<string, number> = {}
      for (const media of contentByDate.data || []) {
        const date = new Date(media.created_at).toISOString().split('T')[0]
        uploadsByDate[date] = (uploadsByDate[date] || 0) + 1
      }
      
      // Group plays by date
      const playsByDateMap: Record<string, number> = {}
      for (const play of playsByDate.data || []) {
        const date = new Date(play.created_at).toISOString().split('T')[0]
        playsByDateMap[date] = (playsByDateMap[date] || 0) + 1
      }
      
      return NextResponse.json({
        type: 'content',
        trendingTracks: trendingTracks.data || [],
        topLikedTracks: topLikedTracks.data || [],
        uploadsByDate: Object.entries(uploadsByDate).map(([date, count]) => ({ date, count })),
        playsByDate: Object.entries(playsByDateMap).map(([date, count]) => ({ date, count }))
      })
    }

    if (type === 'revenue') {
      // Revenue analytics
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      
      const { data: deposits } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('type', 'wallet_deposit')
        .eq('status', 'success')
        .gte('created_at', startDate)
      
      // Group by date
      const revenueByDate: Record<string, number> = {}
      const usersPaid = new Set<string>()
      
      for (const deposit of deposits || []) {
        const date = new Date(deposit.created_at).toISOString().split('T')[0]
        const meta = deposit.metadata as any
        const amount = parseFloat(meta?.deposit_usd || meta?.amount_usd || '0')
        revenueByDate[date] = (revenueByDate[date] || 0) + amount
        usersPaid.add(deposit.user_id)
      }
      
      const totalRevenue = Object.values(revenueByDate).reduce((sum, val) => sum + val, 0)
      const arpu = totalRevenue / usersPaid.size || 0
      
      return NextResponse.json({
        type: 'revenue',
        revenueByDate: Object.entries(revenueByDate).map(([date, amount]) => ({ date, amount })),
        totalRevenue,
        paidUsers: usersPaid.size,
        arpu: arpu.toFixed(2)
      })
    }

    if (type === 'generations') {
      // AI generation analytics
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      
      const { data: jobs } = await supabase
        .from('plugin_jobs')
        .select('*')
        .gte('created_at', startDate)
      
      // Group by type
      const byType: Record<string, { count: number; success: number; failed: number; totalDuration: number }> = {}
      const byDate: Record<string, number> = {}
      
      for (const job of jobs || []) {
        const type = job.type
        if (!byType[type]) byType[type] = { count: 0, success: 0, failed: 0, totalDuration: 0 }
        
        byType[type].count++
        if (job.status === 'completed') byType[type].success++
        if (job.status === 'failed') byType[type].failed++
        
        if (job.completed_at) {
          const duration = new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()
          byType[type].totalDuration += duration / 1000 // seconds
        }
        
        const date = new Date(job.created_at).toISOString().split('T')[0]
        byDate[date] = (byDate[date] || 0) + 1
      }
      
      const typeStats = Object.entries(byType).map(([type, stats]) => ({
        type,
        count: stats.count,
        successRate: ((stats.success / stats.count) * 100).toFixed(1),
        avgDuration: stats.totalDuration > 0 ? (stats.totalDuration / stats.success).toFixed(1) : 0
      }))
      
      return NextResponse.json({
        type: 'generations',
        byType: typeStats,
        byDate: Object.entries(byDate).map(([date, count]) => ({ date, count })),
        totalGenerations: jobs?.length || 0
      })
    }

    if (type === 'activity-feed') {
      // Recent activity feed (last 100 activities)
      const limit = parseInt(searchParams.get('limit') || '100')
      
      const { data: activities } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      
      // Fetch user info for activities
      const userIds = [...new Set((activities || []).map(a => a.user_id))]
      const { data: users } = await supabase
        .from('users')
        .select('clerk_user_id, username, avatar_url')
        .in('clerk_user_id', userIds)
      
      const userMap = new Map(users?.map(u => [u.clerk_user_id, u]) || [])
      
      // Enrich activities with user info
      const enrichedActivities = (activities || []).map(activity => ({
        ...activity,
        user: userMap.get(activity.user_id) || { username: 'Unknown', avatar_url: null }
      }))
      
      return NextResponse.json({
        type: 'activity-feed',
        activities: enrichedActivities
      })
    }

    if (type === 'sessions') {
      // Active sessions
      const { data: activeSessions } = await supabase
        .from('user_sessions')
        .select('*')
        .is('ended_at', null)
        .order('last_activity_at', { ascending: false })
        .limit(100)
      
      // Session stats
      const { data: allSessions } = await supabase
        .from('user_sessions')
        .select('device_type, browser, os')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      
      const deviceStats: Record<string, number> = {}
      const browserStats: Record<string, number> = {}
      const osStats: Record<string, number> = {}
      
      for (const session of allSessions || []) {
        deviceStats[session.device_type] = (deviceStats[session.device_type] || 0) + 1
        browserStats[session.browser] = (browserStats[session.browser] || 0) + 1
        osStats[session.os] = (osStats[session.os] || 0) + 1
      }
      
      return NextResponse.json({
        type: 'sessions',
        activeSessions: activeSessions || [],
        deviceStats,
        browserStats,
        osStats
      })
    }

    if (type === 'credits-by-model') {
      // Credits consumed by AI model type
      const { data: jobs } = await supabase
        .from('plugin_jobs')
        .select('type, credits_cost, params')
        .eq('status', 'completed')
        .not('type', 'is', null)
        .order('created_at', { ascending: false })
      
      // Model name mapping and credit calculation
      const modelStats: Record<string, { runs: number; credits: number; name: string }> = {}
      
      for (const job of jobs || []) {
        const jobType = job.type || 'unknown'
        const actualCredits = job.credits_cost || 0
        
        // Map type to friendly model names
        let modelName = jobType
        if (jobType === 'music') {
          modelName = 'Music Generation'
        } else if (jobType === 'effects') {
          modelName = 'Audio Effects'
        } else if (jobType === 'loops') {
          modelName = 'Loop Generation'
        } else if (jobType === 'stems') {
          modelName = 'Stem Splitting'
        } else if (jobType === 'image') {
          modelName = 'Image Generation'
        } else if (jobType === 'audio-boost') {
          modelName = 'Audio Boost'
        }
        
        if (!modelStats[jobType]) {
          modelStats[jobType] = { runs: 0, credits: 0, name: modelName }
        }
        
        modelStats[jobType].runs++
        modelStats[jobType].credits += actualCredits
      }
      
      // Convert to array and sort by credits descending
      const modelsArray = Object.entries(modelStats).map(([plugin, stats]) => ({
        plugin,
        name: stats.name,
        runs: stats.runs,
        credits: stats.credits
      })).sort((a, b) => b.credits - a.credits)
      
      return NextResponse.json({
        type: 'credits-by-model',
        models: modelsArray,
        totalCredits: modelsArray.reduce((sum, m) => sum + m.credits, 0),
        totalRuns: modelsArray.reduce((sum, m) => sum + m.runs, 0)
      })
    }

    return NextResponse.json({ error: 'Invalid analytics type' }, { status: 400 })
  } catch (err: any) {
    console.error('[Admin Analytics] Error:', err)
    return NextResponse.json({ 
      error: err?.message || 'Internal error',
      details: err?.details 
    }, { status: 500 })
  }
}
