import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const typeFilter = searchParams.get('type') || ''

  const offset = (page - 1) * limit

  try {
    // Build query
    let queryPath = `credit_transactions?user_id=eq.${userId}&order=created_at.desc&offset=${offset}&limit=${limit}`
    if (typeFilter) {
      queryPath += `&type=eq.${typeFilter}`
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
