import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() { return handleOptions() }

/**
 * POST /api/quests/purchase-pass
 * User pays 30 credits ($1) to unlock quest participation for 30 days.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const PASS_COST_CREDITS = 30 // $1 at $0.035 per credit

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

    // 2. Check user credits
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,wallet_balance`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const users = await userRes.json()
    const user = users?.[0]
    if (!user) {
      return corsResponse(NextResponse.json({ error: 'User not found' }, { status: 404 }))
    }

    // Use wallet_balance first, then credits
    const walletBalance = user.wallet_balance || 0
    const credits = user.credits || 0

    if (walletBalance < PASS_COST_CREDITS && credits < PASS_COST_CREDITS) {
      return corsResponse(NextResponse.json({
        error: 'Insufficient balance. You need 30 credits ($1) to purchase a Quest Pass.',
        required: PASS_COST_CREDITS,
        currentWallet: walletBalance,
        currentCredits: credits,
      }, { status: 402 }))
    }

    // 3. Deduct from wallet_balance preferably, otherwise credits
    const deductField = walletBalance >= PASS_COST_CREDITS ? 'wallet_balance' : 'credits'
    const currentBalance = deductField === 'wallet_balance' ? walletBalance : credits

    await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [deductField]: currentBalance - PASS_COST_CREDITS }),
      }
    )

    // 4. Log transaction
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
          type: 'quest_entry',
          credits_amount: -PASS_COST_CREDITS,
          description: 'Quest Entry Pass — 30 Day Access',
          metadata: { pass_type: 'quest_entry', duration_days: 30 },
        }),
      }
    )

    // 5. Create quest pass
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
        }),
      }
    )

    const newPass = await createRes.json()

    return corsResponse(NextResponse.json({
      success: true,
      pass: newPass?.[0],
      deducted: PASS_COST_CREDITS,
      deductedFrom: deductField,
    }))
  } catch (error) {
    console.error('Quest pass purchase error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
