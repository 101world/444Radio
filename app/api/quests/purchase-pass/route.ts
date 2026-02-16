import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() { return handleOptions() }

/**
 * POST /api/quests/purchase-pass
 * User activates quest participation for 30 days.
 * Requires $1+ in wallet (access gate, not deducted).
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    // 1. Check if user already has an active pass
    const passRes = await fetch(
      `${supabaseUrl}/rest/v1/quest_passes?user_id=eq.${userId}&is_active=eq.true&expires_at=gt.${new Date().toISOString()}&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const existingPasses = await passRes.json()
    if (existingPasses?.length) {
      return corsResponse(NextResponse.json({
        error: 'You already have an active quest pass',
        pass: existingPasses[0],
      }, { status: 409 }))
    }

    // 2. Check wallet balance — $1 minimum required (access gate, not deducted)
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,wallet_balance`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const users = await userRes.json()
    const user = users?.[0]
    if (!user) {
      return corsResponse(NextResponse.json({ error: 'User not found' }, { status: 404 }))
    }

    const walletBalance = parseFloat(user.wallet_balance || '0')
    if (walletBalance < 1) {
      return corsResponse(NextResponse.json({
        error: 'You need at least $1 in your wallet to activate the Quest Pass.',
        required: 1,
        currentWallet: walletBalance,
      }, { status: 402 }))
    }

    // 3. Create quest pass (no credits deducted — wallet gate only)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const createRes = await fetch(
      `${supabaseUrl}/rest/v1/quest_passes`,
      {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          user_id: userId,
          expires_at: expiresAt.toISOString(),
          is_active: true,
          credits_spent: 0,
        }),
      }
    )

    const newPass = await createRes.json()

    // 4. Log activation
    await fetch(
      `${supabaseUrl}/rest/v1/credit_transactions`,
      {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          amount: 0,
          type: 'quest_entry',
          status: 'success',
          description: 'Quest Pass activated — 30-day access (wallet $1+ gate)',
          metadata: { pass_type: 'quest_entry', duration_days: 30, wallet_balance: walletBalance },
        }),
      }
    )

    return corsResponse(NextResponse.json({
      success: true,
      pass: newPass?.[0],
      deducted: 0,
      deductedFrom: 'none',
    }))
  } catch (error) {
    console.error('Quest pass activation error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
