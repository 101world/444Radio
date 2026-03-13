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

// Previously we kept an in-memory map to dedupe the same user+action
// for a 30 second window. That convenience caused major problems: if a user
// performed legitimate actions rapidly (e.g. generating multiple songs or
// sharing tracks within the same minute) only the *first* event was applied,
// leaving daily/weekly/monthly quests largely untouched. The progress bar
// would stay at 1/5 or 1/25 even though the user had done the work.
//
// The serverless environment also meant the cache was per-instance and
// therefore unreliable. It's simpler and more correct to drop the dedup logic
// entirely and let each invocation increment progress. Rare duplicate calls
// (from retries or double-clicks) are harmless and easier to reason about.
//
// We keep the constants around in case we want a more sophisticated strategy
// later, but the map is no longer used.
//
const DEDUP_WINDOW_MS = 0 // no deduplication by default

function headers() {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  }
}

/** Check if an error is a timeout / abort (expected on Vercel serverless) */
function isTimeoutOrAbort(err: unknown): boolean {
  if (err instanceof Error) {
    return err.name === 'TimeoutError' || err.name === 'AbortError' ||
           err.message.includes('aborted') || err.message.includes('timeout')
  }
  return false
}

/** Check if Supabase environment variables are properly configured */
function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseKey)
}

/** Create a fetch request with timeout and better error handling */
async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured - missing environment variables')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timeout - Supabase connection issue')
    }
    throw err
  }
}

/** Wrapper around fetch — no AbortSignal since quest tracking is fire-and-forget.
 *  Vercel kills the Lambda naturally; adding a timeout just creates noisy errors. */
function qfetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, init)
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

    // NOTE: deduplication has been disabled (DEDUP_WINDOW_MS = 0).
    // Previous logic prevented any second increment for the same action
    // within a time window, which broke multi-step quests when users were
    // actively generating/sharing in short bursts. Dropping this check lets
    // every call to trackQuestProgress count toward progress.
    // If future abuse proves a problem we can reintroduce a per-request
    // identifier or more targeted dedup strategy.

    // 1-3. Fetch quest pass, active quests, and user quests IN PARALLEL
    const [passRes, allQRes, uqRes] = await Promise.all([
      safeFetch(
        `${supabaseUrl}/rest/v1/quest_passes?user_id=eq.${userId}&is_active=eq.true&expires_at=gt.${new Date().toISOString()}&limit=1`,
        { headers: headers() }
      ),
      safeFetch(
        `${supabaseUrl}/rest/v1/quests?is_active=eq.true&select=id,requirement,quest_level`,
        { headers: headers() }
      ),
      safeFetch(
        `${supabaseUrl}/rest/v1/user_quests?user_id=eq.${userId}&select=id,quest_id,progress,target,status`,
        { headers: headers() }
      ),
    ])

    const passes = await passRes.json()
    // log the pass rows we got (usually 0 or 1)
    console.log(`🔐 trackQuestProgress: user=${userId} action=${action} passCheck =>`, passes)
    if (!passes?.length) {
      // no active pass, nothing to do. Log for debugging so we can see why
      console.log(`🏁 trackQuestProgress: user=${userId} action=${action} skipped (no active pass)`) 
      return // no pass → skip silently
    }

    const allQuests: Array<{ id: string; requirement: { action: string; target: number }; quest_level: number }> = await allQRes.json()
    const matchingQuests = (allQuests || []).filter(q => q.requirement?.action === action)
    if (!matchingQuests.length) {
      console.log(`🏁 trackQuestProgress: user=${userId} action=${action} skipped (no matching active quests)`) 
      return
    }

    const uqRaw = await uqRes.json().catch(() => [])
    const existingUQ: Array<{ id: string; quest_id: string; progress: number; target: number; status: string }> = 
      Array.isArray(uqRaw) ? uqRaw : []
    const existingQuestIds = new Set(existingUQ.map(uq => uq.quest_id))

    // 4. Auto-start any matching quests that don't have a user_quest row yet
    const newlyStarted: Array<{ id: string; quest_id: string; progress: number; target: number; status: string }> = []
    for (const quest of matchingQuests) {
      if (existingQuestIds.has(quest.id)) continue
      const target = quest.requirement?.target || 1
      const startRes = await qfetch(
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
        if (started?.[0]) {
          newlyStarted.push(started[0])
          existingQuestIds.add(quest.id)
          console.log(`🚀 Auto-started quest ${quest.id} for user ${userId} (action: ${action})`)
        }
      }
    }

    // 5. Combine existing active quests + newly started ones
    const activeUQ = [
      ...existingUQ.filter(uq => uq.status === 'active'),
      ...newlyStarted,
    ]

    // 6. Update progress on all active quests matching this action
    const matchingQuestIds = new Set(matchingQuests.map(q => q.id))
    if (matchingQuestIds.size === 0) {
      console.log(`🏁 trackQuestProgress: user=${userId} action=${action} no active quests to update`) 
    }

    // log which quests will be updated
    console.log(`✅ trackQuestProgress: user=${userId} action=${action} will update ${matchingQuestIds.size} quest(s)`, [...matchingQuestIds])
    for (const uq of activeUQ) {
      if (!matchingQuestIds.has(uq.quest_id)) continue

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

      await qfetch(
        `${supabaseUrl}/rest/v1/user_quests?id=eq.${uq.id}`,
        {
          method: 'PATCH',
          headers: headers(),
          body: JSON.stringify(patchBody),
        }
      )

      console.log(`✔ progress updated for user=${userId} quest=${uq.quest_id} progress=${newProgress}/${uq.target} (completed=${completed})`)
      if (completed) {
        console.log(`🏆 Quest completed: user=${userId} quest=${uq.quest_id} action=${action}`)
      }
    }
  } catch (err) {
    // Fire-and-forget — never let quest tracking break a generation route
    // Timeout/abort errors are expected on Vercel (Lambda killed after response sent)
    if (!isTimeoutOrAbort(err)) {
      console.error('Quest progress tracking error (non-critical):', err)
    }
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
    await qfetch(
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
    const usageRes = await safeFetch(
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
    if (!isTimeoutOrAbort(err)) {
      console.error('Model usage tracking error (non-critical):', err)
    }
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
    await qfetch(
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
    const todayRes = await safeFetch(
      `${supabaseUrl}/rest/v1/generation_streaks?user_id=eq.${userId}&streak_date=eq.${today}&select=generated,released`,
      { headers: headers() }
    )
    const todayData = await todayRes.json()
    
    if (todayData?.[0]?.generated && todayData?.[0]?.released) {
      // Calculate current streak
      const streakRes = await safeFetch(
        `${supabaseUrl}/rpc/get_user_streak`,
        {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ p_user_id: userId }),
        }
      )
      const currentStreak = parseInt(await streakRes.text()) || 0
      if (currentStreak < 1) return
      
      // Auto-start streak quests (increment=0 just ensures user_quests rows exist)
      await trackQuestProgress(userId, 'streak_lord', 0)

      // Set absolute progress = current streak count on all streak_lord user_quests
      const streakQuestRes = await safeFetch(
        `${supabaseUrl}/rest/v1/quests?requirement->>action=eq.streak_lord&is_active=eq.true&select=id,requirement`,
        { headers: headers() }
      )
      const streakQuests = await streakQuestRes.json()
      
      for (const quest of (streakQuests || [])) {
        const target = quest.requirement?.target || 30
        const newProgress = Math.min(currentStreak, target)
        const completed = newProgress >= target
        const patchBody: Record<string, any> = {
          progress: newProgress,
          updated_at: new Date().toISOString(),
        }
        if (completed) {
          patchBody.status = 'completed'
          patchBody.completed_at = new Date().toISOString()
        }
        await qfetch(
          `${supabaseUrl}/rest/v1/user_quests?user_id=eq.${userId}&quest_id=eq.${quest.id}&status=eq.active`,
          {
            method: 'PATCH',
            headers: headers(),
            body: JSON.stringify(patchBody),
          }
        )
        if (completed) {
          console.log(`🏆 Streak quest completed: user=${userId} quest=${quest.id} streak=${currentStreak}`)
        }
      }
    }
  } catch (err) {
    if (!isTimeoutOrAbort(err)) {
      console.error('Generation streak tracking error (non-critical):', err)
    }
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
    await qfetch(
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
    if (!isTimeoutOrAbort(err)) {
      console.error('Release streak tracking error (non-critical):', err)
    }
  }
}
