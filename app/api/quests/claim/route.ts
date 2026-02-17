import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction } from '@/lib/credit-transactions'

export async function OPTIONS() { return handleOptions() }

/**
 * POST /api/quests/claim
 * User claims reward for a completed quest.
 * Body: { questId: string }
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    const { questId } = await req.json()
    if (!questId) {
      return corsResponse(NextResponse.json({ error: 'questId required' }, { status: 400 }))
    }

    // 1. Verify user quest is completed but not yet claimed
    const uqRes = await fetch(
      `${supabaseUrl}/rest/v1/user_quests?user_id=eq.${userId}&quest_id=eq.${questId}&status=eq.completed&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const userQuests = await uqRes.json()
    if (!userQuests?.length) {
      return corsResponse(NextResponse.json({ error: 'Quest not completed or already claimed' }, { status: 400 }))
    }

    // 2. Get quest reward info
    const questRes = await fetch(
      `${supabaseUrl}/rest/v1/quests?id=eq.${questId}&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const quests = await questRes.json()
    if (!quests?.length) {
      return corsResponse(NextResponse.json({ error: 'Quest not found' }, { status: 404 }))
    }

    const quest = quests[0]
    const reward = quest.credits_reward || 0

    // 3. INSERT completion FIRST (before credits) — prevents race condition.
    // If two requests race, the second INSERT fails on the unique constraint
    // and no credits are ever awarded twice.
    const insertRes = await fetch(
      `${supabaseUrl}/rest/v1/quest_completions`,
      {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          user_id: userId,
          quest_id: questId,
          credits_awarded: reward,
        }),
      }
    )

    if (!insertRes.ok) {
      // 409 or unique constraint failure = already claimed
      const insertErr = await insertRes.text()
      if (insertRes.status === 409 || insertErr.includes('duplicate') || insertErr.includes('unique')) {
        return corsResponse(NextResponse.json({ error: 'Reward already claimed' }, { status: 409 }))
      }
      console.error('Quest completion insert failed:', insertErr)
      return corsResponse(NextResponse.json({ error: 'Failed to record completion' }, { status: 500 }))
    }

    // 4. Award credits to user (safe now — completion record exists, so no double-claim)
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const users = await userRes.json()
    const currentCredits = users?.[0]?.credits || 0

    await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credits: currentCredits + reward }),
      }
    )

    // 5. Log in credit_transactions via helper (retries + enrichment)
    await logCreditTransaction({
      userId,
      amount: reward,
      balanceAfter: currentCredits + reward,
      type: 'quest_reward',
      description: `Quest Reward: ${quest.title} (+${reward} credits)`,
      metadata: { quest_id: questId, quest_title: quest.title, quest_type: quest.quest_type },
    })

    // 6. Update user_quest status to 'claimed'
    await fetch(
      `${supabaseUrl}/rest/v1/user_quests?user_id=eq.${userId}&quest_id=eq.${questId}`,
      {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'claimed', claimed_at: new Date().toISOString() }),
      }
    )

    return corsResponse(NextResponse.json({
      success: true,
      creditsAwarded: reward,
      newBalance: currentCredits + reward,
    }))
  } catch (error) {
    console.error('Quest claim error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
