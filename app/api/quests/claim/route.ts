import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

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

    // 3. Check for duplicate claim (idempotency)
    const dupRes = await fetch(
      `${supabaseUrl}/rest/v1/quest_completions?user_id=eq.${userId}&quest_id=eq.${questId}&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const dups = await dupRes.json()
    if (dups?.length) {
      return corsResponse(NextResponse.json({ error: 'Reward already claimed' }, { status: 409 }))
    }

    // 4. Award credits to user
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

    // 5. Log in credit_transactions
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
          type: 'quest_reward',
          credits_amount: reward,
          description: `Quest Reward: ${quest.title}`,
          metadata: { quest_id: questId, quest_title: quest.title, quest_type: quest.quest_type },
        }),
      }
    )

    // 6. Insert completion log
    await fetch(
      `${supabaseUrl}/rest/v1/quest_completions`,
      {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          quest_id: questId,
          credits_awarded: reward,
        }),
      }
    )

    // 7. Update user_quest status to 'claimed'
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
