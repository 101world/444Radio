import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction } from '@/lib/credit-transactions'

export async function OPTIONS() { return handleOptions() }

const QUEST_PASS_COST = 30 // credits

/**
 * POST /api/quests/purchase-pass
 * Deducts 30 credits and creates a 30-day quest pass.
 * Requires $1+ wallet balance (enforced by deduct_credits RPC).
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

    // 2. Check credits balance before calling RPC (quick pre-check)
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,wallet_balance`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const users = await userRes.json()
    const user = users?.[0]
    if (!user) {
      return corsResponse(NextResponse.json({ error: 'User not found' }, { status: 404 }))
    }

    if ((user.credits || 0) < QUEST_PASS_COST) {
      return corsResponse(NextResponse.json({
        error: `Quest Pass costs ${QUEST_PASS_COST} credits. You have ${user.credits || 0}.`,
        required: QUEST_PASS_COST,
        creditsAvailable: user.credits || 0,
      }, { status: 402 }))
    }

    // 3. Atomically deduct 30 credits via deduct_credits RPC
    //    This also checks $1 wallet gate and does FOR UPDATE locking
    const deductRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/deduct_credits`,
      {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_clerk_user_id: userId,
          p_amount: QUEST_PASS_COST,
          p_type: 'quest_entry',
          p_description: `Quest Pass activated — 30-day access (${QUEST_PASS_COST} credits)`,
          p_metadata: { pass_type: 'quest_entry', duration_days: 30, cost: QUEST_PASS_COST },
        }),
      }
    )

    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) {
      const raw = await deductRes.json()
      deductResult = Array.isArray(raw) ? raw[0] ?? null : raw
    }

    if (!deductRes.ok || !deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      console.error('❌ Quest pass credit deduction failed:', errorMsg)
      // Log the failed attempt
      await logCreditTransaction({
        userId,
        amount: -QUEST_PASS_COST,
        type: 'quest_entry',
        status: 'failed',
        description: `Quest Pass purchase failed: ${errorMsg}`,
        metadata: { cost: QUEST_PASS_COST },
      }).catch(() => {})
      return corsResponse(NextResponse.json({
        error: errorMsg.includes('Wallet balance')
          ? 'You need at least $1 in your wallet to purchase the Quest Pass.'
          : errorMsg.includes('Insufficient')
            ? `Not enough credits. Quest Pass costs ${QUEST_PASS_COST} credits.`
            : 'Failed to purchase Quest Pass. Please try again.',
      }, { status: 402 }))
    }

    console.log(`✅ Quest pass credits deducted. Remaining: ${deductResult.new_credits}`)

    // 4. Create quest pass
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
          credits_spent: QUEST_PASS_COST,
        }),
      }
    )

    if (!createRes.ok) {
      const err = await createRes.text()
      console.error('❌ Failed to create quest pass row:', err)
      // Credits already deducted — refund them
      await fetch(
        `${supabaseUrl}/rest/v1/rpc/deduct_credits`,
        {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_clerk_user_id: userId,
            p_amount: -QUEST_PASS_COST,
            p_type: 'credit_refund',
            p_description: `Quest Pass refund — pass creation failed`,
            p_metadata: { refund_reason: 'pass_creation_failed' },
          }),
        }
      ).catch(() => {})
      // Manual refund since deduct_credits doesn't accept negative
      await fetch(
        `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ credits: (deductResult.new_credits || 0) + QUEST_PASS_COST }),
        }
      ).catch(() => {})
      return corsResponse(NextResponse.json({ error: 'Failed to create Quest Pass. Credits refunded.' }, { status: 500 }))
    }

    const newPass = await createRes.json()

    return corsResponse(NextResponse.json({
      success: true,
      pass: Array.isArray(newPass) ? newPass[0] : newPass,
      creditsDeducted: QUEST_PASS_COST,
      creditsRemaining: deductResult.new_credits,
    }))
  } catch (error) {
    console.error('Quest pass activation error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
