/**
 * Admin Plugin Purchases API
 * GET /api/admin/plugin-purchases — Lists all plugin purchases with user info
 * 
 * Protected by Clerk middleware (admin must be logged in).
 * Additional check: only allow admin user ID.
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

const ADMIN_USER_ID = 'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET() {
  const { userId } = await auth()
  if (userId !== ADMIN_USER_ID) {
    return corsResponse(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    // Fetch all plugin purchases (newest first)
    const purchasesRes = await fetch(
      `${supabaseUrl}/rest/v1/plugin_purchases?select=*&order=created_at.desc&limit=200`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )
    const purchases = await purchasesRes.json()

    if (!Array.isArray(purchases)) {
      return corsResponse(NextResponse.json({ purchases: [], stats: { total: 0, completed: 0, pending: 0, revenue: 0 } }))
    }

    // Enrich with user info (batch lookup)
    const userIds = [...new Set(purchases.map((p: any) => p.clerk_user_id))]
    let userMap: Record<string, any> = {}
    if (userIds.length > 0) {
      const usersRes = await fetch(
        `${supabaseUrl}/rest/v1/users?clerk_user_id=in.(${userIds.join(',')}')&select=clerk_user_id,username,email,subscription_plan,subscription_status`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      )
      const users = await usersRes.json()
      if (Array.isArray(users)) {
        for (const u of users) {
          userMap[u.clerk_user_id] = u
        }
      }
    }

    // Build enriched response
    const enriched = purchases.map((p: any) => ({
      ...p,
      user: userMap[p.clerk_user_id] || null,
    }))

    // Stats
    const completed = purchases.filter((p: any) => p.status === 'completed')
    const pending = purchases.filter((p: any) => p.status === 'pending')
    const revenue = completed.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

    return corsResponse(NextResponse.json({
      purchases: enriched,
      stats: {
        total: purchases.length,
        completed: completed.length,
        pending: pending.length,
        revenue, // in cents
        revenueDisplay: `$${(revenue / 100).toFixed(2)}`,
      },
    }))
  } catch (error: any) {
    console.error('[admin/plugin-purchases] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Failed to fetch purchases' }, { status: 500 }))
  }
}
