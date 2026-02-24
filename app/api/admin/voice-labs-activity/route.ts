import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { ADMIN_CLERK_ID } from '@/lib/constants'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/admin/voice-labs-activity
 * Admin-only endpoint to view Voice Labs activity.
 *
 * Query params:
 *   view=stats      — per-user aggregated stats (default)
 *   view=feed       — raw activity feed (most recent first)
 *   view=generations— generation events only
 *   user_id=xxx     — filter to specific user
 *   days=30         — time range (default 30)
 *   limit=100       — max rows for feed view (default 100)
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId || userId !== ADMIN_CLERK_ID) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 }))
    }

    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') || 'stats'
    const filterUserId = searchParams.get('user_id') || null
    const days = parseInt(searchParams.get('days') || '30')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)

    if (view === 'stats') {
      // ── Aggregated per-user stats via RPC ──
      const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_voice_labs_user_stats`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_user_id: filterUserId,
          p_days: days,
        }),
      })

      if (!rpcRes.ok) {
        // Fallback: direct query
        console.error('RPC get_voice_labs_user_stats failed:', rpcRes.status)
        return corsResponse(NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 }))
      }

      const stats = await rpcRes.json()

      // Get usernames for display
      const userIds = (Array.isArray(stats) ? stats : []).map((s: { user_id: string }) => s.user_id)
      let userMap: Record<string, string> = {}
      if (userIds.length > 0) {
        const userFilter = userIds.map((id: string) => `"${id}"`).join(',')
        const usersRes = await fetch(
          `${supabaseUrl}/rest/v1/users?clerk_user_id=in.(${userFilter})&select=clerk_user_id,username,display_name`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        )
        if (usersRes.ok) {
          const users = await usersRes.json()
          for (const u of users) {
            userMap[u.clerk_user_id] = u.display_name || u.username || u.clerk_user_id
          }
        }
      }

      return corsResponse(NextResponse.json({
        success: true,
        view: 'stats',
        days,
        data: (Array.isArray(stats) ? stats : []).map((s: Record<string, unknown>) => ({
          ...s,
          display_name: userMap[(s.user_id as string)] || s.user_id,
        })),
      }))
    }

    if (view === 'feed' || view === 'generations') {
      // ── Raw activity feed ──
      let url = `${supabaseUrl}/rest/v1/voice_labs_activity?order=created_at.desc&limit=${limit}`

      if (filterUserId) {
        url += `&user_id=eq.${filterUserId}`
      }

      if (view === 'generations') {
        url += `&event_type=in.(generation_start,generation_complete,generation_failed)`
      }

      // Time filter
      const since = new Date(Date.now() - days * 86400000).toISOString()
      url += `&created_at=gte.${since}`

      const actRes = await fetch(url, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      })

      if (!actRes.ok) {
        return corsResponse(NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 }))
      }

      const activities = await actRes.json()

      // Get unique user IDs for display names
      const uniqueUserIds = [...new Set((activities || []).map((a: { user_id: string }) => a.user_id))]
      let userMap: Record<string, string> = {}
      if (uniqueUserIds.length > 0) {
        const userFilter = uniqueUserIds.map(id => `"${id}"`).join(',')
        const usersRes = await fetch(
          `${supabaseUrl}/rest/v1/users?clerk_user_id=in.(${userFilter})&select=clerk_user_id,username,display_name`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        )
        if (usersRes.ok) {
          const users = await usersRes.json()
          for (const u of users) {
            userMap[u.clerk_user_id] = u.display_name || u.username || u.clerk_user_id
          }
        }
      }

      return corsResponse(NextResponse.json({
        success: true,
        view,
        days,
        count: (activities || []).length,
        data: (activities || []).map((a: Record<string, unknown>) => ({
          ...a,
          display_name: userMap[(a.user_id as string)] || a.user_id,
        })),
      }))
    }

    return corsResponse(NextResponse.json({ error: 'Invalid view. Use: stats, feed, generations' }, { status: 400 }))
  } catch (error) {
    console.error('Admin voice labs activity error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
