import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() { return handleOptions() }

/**
 * POST /api/quests/start
 * User starts a quest — creates a user_quests row.
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

    // Check active pass
    const passRes = await fetch(
      `${supabaseUrl}/rest/v1/quest_passes?user_id=eq.${userId}&is_active=eq.true&expires_at=gt.${new Date().toISOString()}&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const passes = await passRes.json()
    if (!passes?.length) {
      return corsResponse(NextResponse.json({ error: 'No active quest pass. Purchase one to participate.' }, { status: 403 }))
    }

    // Fetch quest to get target
    const questRes = await fetch(
      `${supabaseUrl}/rest/v1/quests?id=eq.${questId}&is_active=eq.true&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const quests = await questRes.json()
    if (!quests?.length) {
      return corsResponse(NextResponse.json({ error: 'Quest not found or inactive' }, { status: 404 }))
    }

    const quest = quests[0]
    const target = quest.requirement?.target || 1

    // Check if user_quest already exists (don't reset progress!)
    const existingRes = await fetch(
      `${supabaseUrl}/rest/v1/user_quests?user_id=eq.${userId}&quest_id=eq.${questId}&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const existing = await existingRes.json()

    if (existing?.length) {
      // Already started (possibly auto-started by trackQuestProgress) — return existing progress
      return corsResponse(NextResponse.json({ success: true, userQuest: existing[0] }))
    }

    // Insert new user quest (only if none exists — never overwrite progress)
    const insertRes = await fetch(
      `${supabaseUrl}/rest/v1/user_quests`,
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
          quest_id: questId,
          progress: 0,
          target,
          status: 'active',
          started_at: new Date().toISOString(),
        }),
      }
    )

    if (!insertRes.ok) {
      const err = await insertRes.text()
      // Unique constraint violation = already exists (race condition) — return success
      if (insertRes.status === 409 || err.includes('duplicate') || err.includes('unique')) {
        const refetchRes = await fetch(
          `${supabaseUrl}/rest/v1/user_quests?user_id=eq.${userId}&quest_id=eq.${questId}&limit=1`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        )
        const refetched = await refetchRes.json()
        return corsResponse(NextResponse.json({ success: true, userQuest: refetched?.[0] }))
      }
      console.error('Quest start insert failed:', err)
      return corsResponse(NextResponse.json({ error: 'Failed to start quest' }, { status: 500 }))
    }

    const userQuest = await insertRes.json()
    return corsResponse(NextResponse.json({ success: true, userQuest: userQuest?.[0] }))
  } catch (error) {
    console.error('Quest start error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
