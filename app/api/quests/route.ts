import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() { return handleOptions() }

/**
 * GET /api/quests
 * Returns all active quests + user's progress & pass status.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    // 1. Fetch all active quests
    const questsRes = await fetch(
      `${supabaseUrl}/rest/v1/quests?is_active=eq.true&order=quest_type.asc,credits_reward.desc`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const quests = await questsRes.json()

    // 2. Fetch user's active quest pass
    const passRes = await fetch(
      `${supabaseUrl}/rest/v1/quest_passes?user_id=eq.${userId}&is_active=eq.true&order=expires_at.desc&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const passes = await passRes.json()
    const activePass = passes?.[0] && new Date(passes[0].expires_at) > new Date() ? passes[0] : null

    // 3. Fetch user's quest progress
    const progressRes = await fetch(
      `${supabaseUrl}/rest/v1/user_quests?user_id=eq.${userId}&select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const userQuests = await progressRes.json()

    // 4. Fetch user's completions count
    const completionsRes = await fetch(
      `${supabaseUrl}/rest/v1/quest_completions?user_id=eq.${userId}&select=id`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: 'count=exact' } }
    )
    const totalCompleted = parseInt(completionsRes.headers.get('content-range')?.split('/')[1] || '0', 10)

    // Map progress onto quests
    const progressMap: Record<string, any> = {}
    for (const uq of (userQuests || [])) {
      progressMap[uq.quest_id] = uq
    }

    const enrichedQuests = (quests || []).map((q: any) => ({
      ...q,
      userProgress: progressMap[q.id] || null,
    }))

    return corsResponse(NextResponse.json({
      success: true,
      quests: enrichedQuests,
      pass: activePass,
      totalCompleted,
    }))
  } catch (error) {
    console.error('Quest fetch error:', error)
    return corsResponse(NextResponse.json({ error: 'Failed to fetch quests' }, { status: 500 }))
  }
}
