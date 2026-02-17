/**
 * Quest Progress Tracker
 *
 * Shared helper used by generation + action API routes to auto-increment
 * quest progress for authenticated users.
 *
 * Usage (fire-and-forget — never blocks the parent route):
 *   import { trackQuestProgress } from '@/lib/quest-progress'
 *   trackQuestProgress(userId, 'generate_songs')          // +1 default
 *   trackQuestProgress(userId, 'generate_songs', 3)       // +3
 *   trackQuestProgress(userId, 'use_genres', 1, 'lofi')   // with genre ctx
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function headers() {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Increment quest progress for every *active* user_quest that matches
 * the given action. If progress reaches target → mark completed.
 *
 * This is fully async / fire-and-forget. Errors are logged, never thrown.
 */
export async function trackQuestProgress(
  userId: string,
  action: string,
  increment: number = 1,
  _context?: string, // e.g. genre name — reserved for future use
): Promise<void> {
  try {
    if (!supabaseUrl || !supabaseKey) return

    // 1. Check user has an active quest pass
    const passRes = await fetch(
      `${supabaseUrl}/rest/v1/quest_passes?user_id=eq.${userId}&is_active=eq.true&expires_at=gt.${new Date().toISOString()}&limit=1`,
      { headers: headers() }
    )
    const passes = await passRes.json()
    if (!passes?.length) return // no pass → skip silently

    // 2. Fetch all active user_quests for this user whose quest action matches
    //    We need the quest definition to know the action, so join via quest_id
    const uqRes = await fetch(
      `${supabaseUrl}/rest/v1/user_quests?user_id=eq.${userId}&status=eq.active&select=id,quest_id,progress,target`,
      { headers: headers() }
    )
    let userQuests: Array<{ id: string; quest_id: string; progress: number; target: number }> = await uqRes.json()

    // 2b. If the user has no active user_quests, auto-start all matching quests
    //     This fixes the bug where users buy a pass but never manually "start" quests
    if (!userQuests?.length || !Array.isArray(userQuests)) {
      userQuests = []
      // Fetch all active quests whose action matches
      const allQRes = await fetch(
        `${supabaseUrl}/rest/v1/quests?is_active=eq.true&select=id,requirement`,
        { headers: headers() }
      )
      const allQuests: Array<{ id: string; requirement: { action: string; target: number } }> = await allQRes.json()
      const matchingQuests = (allQuests || []).filter(q => q.requirement?.action === action)

      for (const quest of matchingQuests) {
        const target = quest.requirement?.target || 1
        const startRes = await fetch(
          `${supabaseUrl}/rest/v1/user_quests?on_conflict=user_id,quest_id`,
          {
            method: 'POST',
            headers: { ...headers(), Prefer: 'return=representation,resolution=merge-duplicates' },
            body: JSON.stringify({
              user_id: userId,
              quest_id: quest.id,
              progress: 0,
              target,
              status: 'active',
              started_at: new Date().toISOString(),
            }),
          }
        )
        if (startRes.ok) {
          const started = await startRes.json()
          if (started?.[0]) userQuests.push(started[0])
          console.log(`🚀 Auto-started quest ${quest.id} for user ${userId} (action: ${action})`)
        }
      }
      if (!userQuests.length) return
    }

    // 3. For each user quest, fetch the quest to see if the action matches
    //    (batch-fetch all quest ids)
    const questIds = [...new Set(userQuests.map(uq => uq.quest_id))]
    const qRes = await fetch(
      `${supabaseUrl}/rest/v1/quests?id=in.(${questIds.join(',')})&is_active=eq.true&select=id,requirement`,
      { headers: headers() }
    )
    const quests: Array<{ id: string; requirement: { action: string; target: number } }> = await qRes.json()
    const questMap = new Map(quests.map(q => [q.id, q]))

    // 4. Update matching quests
    for (const uq of userQuests) {
      const quest = questMap.get(uq.quest_id)
      if (!quest) continue
      if (quest.requirement?.action !== action) continue

      const newProgress = Math.min(uq.progress + increment, uq.target)
      const completed = newProgress >= uq.target

      const patchBody: Record<string, any> = {
        progress: newProgress,
        updated_at: new Date().toISOString(),
      }
      if (completed) {
        patchBody.status = 'completed'
        patchBody.completed_at = new Date().toISOString()
      }

      await fetch(
        `${supabaseUrl}/rest/v1/user_quests?id=eq.${uq.id}`,
        {
          method: 'PATCH',
          headers: headers(),
          body: JSON.stringify(patchBody),
        }
      )

      if (completed) {
        console.log(`🏆 Quest completed: user=${userId} quest=${uq.quest_id} action=${action}`)
      }
    }
  } catch (err) {
    // Fire-and-forget — never let quest tracking break a generation route
    console.error('Quest progress tracking error (non-critical):', err)
  }
}
