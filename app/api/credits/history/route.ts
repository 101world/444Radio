import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/credits/history
 * Returns the user's credit transaction history (most recent first).
 * Query params:
 *   limit  — max rows (default 50, max 200)
 *   offset — pagination offset (default 0)
 */
export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const url = new URL(request.url)
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200)
  const offset = Number(url.searchParams.get('offset') || 0)

  const { data: transactions, error, count } = await supabaseAdmin
    .from('credit_transactions')
    .select('id, type, status, amount, balance_after, description, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[credits/history] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 }))
  }

  return corsResponse(NextResponse.json({
    transactions: transactions || [],
    total: count || 0,
    limit,
    offset,
  }))
}
