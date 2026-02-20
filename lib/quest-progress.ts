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
 *   trackModelUsage(userId, 'chirp-v3-5')                 // track model usage
 *   trackGenerationStreak(userId)                         // track daily generation
 *   trackReleaseStreak(userId)                            // track daily release
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

/**
 * Track model usage for "use all models" quest.
 * Call this every time a user generates with a specific model.
 */
export async function trackModelUsage(
  userId: string,
  modelName: string,
): Promise<void> {
  try {
    if (!supabaseUrl || !supabaseKey || !modelName) return

    // Upsert model usage
    await fetch(
      `${supabaseUrl}/rest/v1/user_model_usage?on_conflict=user_id,model_name`,
      {
        method: 'POST',
        headers: { ...headers(), Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          user_id: userId,
          model_name: modelName,
          use_count: 1,
        }),
      }
    )

    // Check if user has used all available models
    const usageRes = await fetch(
      `${supabaseUrl}/rest/v1/user_model_usage?user_id=eq.${userId}&select=model_name`,
      { headers: headers() }
    )
    const usedModels = await usageRes.json()
    
    // List of all available models (update as you add more)
    const allModels = [
      'chirp-v3-5',
      'chirp-v3',
      'chirp-v2',
      'stable-audio',
      'musicgen',
      'riffusion',
    ]

    const modelSet = new Set((usedModels || []).map((m: any) => m.model_name))
    const hasUsedAllModels = allModels.every(model => modelSet.has(model))

    if (hasUsedAllModels) {
      trackQuestProgress(userId, 'use_all_models').catch(() => {})
    }
  } catch (err) {
    console.error('Model usage tracking error (non-critical):', err)
  }
}

/**
 * Track daily generation for Streak Lord quest.
 * Call this when a user generates any content.
 */
export async function trackGenerationStreak(userId: string): Promise<void> {
  try {
    if (!supabaseUrl || !supabaseKey) return

    const today = new Date().toISOString().split('T')[0]

    // Upsert today's streak record
    await fetch(
      `${supabaseUrl}/rest/v1/generation_streaks?on_conflict=user_id,streak_date`,
      {
        method: 'POST',
        headers: { ...headers(), Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          user_id: userId,
          streak_date: today,
          generated: true,
        }),
      }
    )

    // Check if both generated AND released today
    const todayRes = await fetch(
      `${supabaseUrl}/rest/v1/generation_streaks?user_id=eq.${userId}&streak_date=eq.${today}&select=generated,released`,
      { headers: headers() }
    )
    const todayData = await todayRes.json()
    
    if (todayData?.[0]?.generated && todayData?.[0]?.released) {
      // Calculate current streak
      const streakRes = await fetch(
        `${supabaseUrl}/rpc/get_user_streak`,
        {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ p_user_id: userId }),
        }
      )
      const currentStreak = parseInt(await streakRes.text()) || 0
      
      // Update Streak Lord quest with current streak count
      trackQuestProgress(userId, 'streak_lord', 0).catch(() => {})
      
      // Manually update progress to streak count
      const passRes = await fetch(
        `${supabaseUrl}/rest/v1/quest_passes?user_id=eq.${userId}&is_active=eq.true&expires_at=gt.${new Date().toISOString()}&limit=1`,
        { headers: headers() }
      )
      const passes = await passRes.json()
      if (!passes?.length) return

      const streakQuestRes = await fetch(
        `${supabaseUrl}/rest/v1/quests?requirement->>action=eq.streak_lord&is_active=eq.true&select=id`,
        { headers: headers() }
      )
      const streakQuests = await streakQuestRes.json()
      
      for (const quest of (streakQuests || [])) {
        await fetch(
          `${supabaseUrl}/rest/v1/user_quests?user_id=eq.${userId}&quest_id=eq.${quest.id}`,
          {
            method: 'PATCH',
            headers: headers(),
            body: JSON.stringify({
              progress: currentStreak,
              updated_at: new Date().toISOString(),
            }),
          }
        )
      }
    }
  } catch (err) {
    console.error('Generation streak tracking error (non-critical):', err)
  }
}

/**
 * Track daily release for Streak Lord quest.
 * Call this when a user releases/publishes a track.
 */
export async function trackReleaseStreak(userId: string): Promise<void> {
  try {
    if (!supabaseUrl || !supabaseKey) return

    const today = new Date().toISOString().split('T')[0]

    // Upsert today's streak record - mark released
    await fetch(
      `${supabaseUrl}/rest/v1/generation_streaks?on_conflict=user_id,streak_date`,
      {
        method: 'POST',
        headers: { ...headers(), Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          user_id: userId,
          streak_date: today,
          released: true,
        }),
      }
    )

    // Trigger streak calculation (same as generation)
    trackGenerationStreak(userId).catch(() => {})
  } catch (err) {
    console.error('Release streak tracking error (non-critical):', err)
  }
}
