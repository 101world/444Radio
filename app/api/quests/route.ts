import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() { return handleOptions() }

/**
 * GET /api/quests
 * Returns all active quests + user's progress & pass status + level info.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const h = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }

  try {
    // 1. Fetch all active quests (including quest_level)
    const questsRes = await fetch(
      `${supabaseUrl}/rest/v1/quests?is_active=eq.true&order=quest_level.asc,quest_type.asc,credits_reward.desc`,
      { headers: h }
    )
    const quests = await questsRes.json()

    // 2. Fetch user's active quest pass
    const passRes = await fetch(
      `${supabaseUrl}/rest/v1/quest_passes?user_id=eq.${userId}&is_active=eq.true&order=expires_at.desc&limit=1`,
      { headers: h }
    )
    const passes = await passRes.json()
    const activePass = passes?.[0] && new Date(passes[0].expires_at) > new Date() ? passes[0] : null

    // 3. Fetch user's quest progress
    const progressRes = await fetch(
      `${supabaseUrl}/rest/v1/user_quests?user_id=eq.${userId}&select=*`,
      { headers: h }
    )
    const userQuests = await progressRes.json()

    // 4. Fetch user's completions count
    const completionsRes = await fetch(
      `${supabaseUrl}/rest/v1/quest_completions?user_id=eq.${userId}&select=id`,
      { headers: { ...h, Prefer: 'count=exact' } }
    )
    const totalCompleted = parseInt(completionsRes.headers.get('content-range')?.split('/')[1] || '0', 10)

    // 5. Get user's max unlocked quest level via RPC
    let userLevel = 1
    try {
      const levelRes = await fetch(
        `${supabaseUrl}/rest/v1/rpc/get_user_quest_level`,
        {
          method: 'POST',
          headers: { ...h, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_user_id: userId }),
        }
      )
      if (levelRes.ok) {
        const lvl = await levelRes.json()
        userLevel = typeof lvl === 'number' ? lvl : (parseInt(String(lvl)) || 1)
      }
    } catch {
      // If RPC doesn't exist yet (migration not run), default to 1
      userLevel = 1
    }

    // 6. Calculate per-level completion stats
    const levelStats: Record<number, { total: number; completed: number }> = {}
    for (const q of (quests || [])) {
      const lvl = q.quest_level || 1
      if (!levelStats[lvl]) levelStats[lvl] = { total: 0, completed: 0 }
      levelStats[lvl].total++
    }

    // Map progress onto quests
    const progressMap: Record<string, any> = {}
    for (const uq of (userQuests || [])) {
      progressMap[uq.quest_id] = uq
    }

    const enrichedQuests = (quests || []).map((q: any) => {
      const progress = progressMap[q.id] || null
      const lvl = q.quest_level || 1
      if (progress && (progress.status === 'completed' || progress.status === 'claimed')) {
        if (levelStats[lvl]) levelStats[lvl].completed++
      }
      return { ...q, userProgress: progress }
    })

    return corsResponse(NextResponse.json({
      success: true,
      quests: enrichedQuests,
      pass: activePass,
      totalCompleted,
      userLevel,
      levelStats,
    }))
  } catch (error) {
    console.error('Quest fetch error:', error)
    return corsResponse(NextResponse.json({ error: 'Failed to fetch quests' }, { status: 500 }))
  }
}
