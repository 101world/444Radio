import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() { return handleOptions() }

const ADMIN_EMAIL = '444radioog@gmail.com'

async function isAdmin(userId: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const res = await fetch(
    `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=email`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  )
  const users = await res.json()
  return users?.[0]?.email === ADMIN_EMAIL
}

/**
 * GET /api/quests/admin — list all quests (including inactive)
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  if (!(await isAdmin(userId))) return corsResponse(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    // All quests
    const questsRes = await fetch(
      `${supabaseUrl}/rest/v1/quests?order=created_at.desc`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const quests = await questsRes.json()

    // Stats: total participants, completions
    const passCountRes = await fetch(
      `${supabaseUrl}/rest/v1/quest_passes?select=id&is_active=eq.true`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: 'count=exact' } }
    )
    const activePassCount = parseInt(passCountRes.headers.get('content-range')?.split('/')[1] || '0', 10)

    const completionCountRes = await fetch(
      `${supabaseUrl}/rest/v1/quest_completions?select=id`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: 'count=exact' } }
    )
    const totalCompletions = parseInt(completionCountRes.headers.get('content-range')?.split('/')[1] || '0', 10)

    // Total rewards distributed
    const rewardsRes = await fetch(
      `${supabaseUrl}/rest/v1/credit_transactions?type=eq.quest_reward&select=credits_amount`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const rewardTxs = await rewardsRes.json()
    const totalRewards = (rewardTxs || []).reduce((sum: number, t: any) => sum + (t.credits_amount || 0), 0)

    return corsResponse(NextResponse.json({
      success: true,
      quests,
      stats: { activePassCount, totalCompletions, totalRewards },
    }))
  } catch (error) {
    console.error('Admin quests fetch error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}

/**
 * POST /api/quests/admin — create or update a quest
 * Body: { id?, title, description, quest_type, requirement, credits_reward, is_active, starts_at?, ends_at? }
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  if (!(await isAdmin(userId))) return corsResponse(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    const body = await req.json()
    const { id, title, description, quest_type, requirement, credits_reward, is_active, starts_at, ends_at } = body

    if (!title || !quest_type) {
      return corsResponse(NextResponse.json({ error: 'title and quest_type required' }, { status: 400 }))
    }

    const questData: any = {
      title,
      description: description || '',
      quest_type,
      requirement: requirement || {},
      credits_reward: credits_reward || 0,
      is_active: is_active ?? true,
      updated_at: new Date().toISOString(),
    }
    if (starts_at) questData.starts_at = starts_at
    if (ends_at) questData.ends_at = ends_at
    if (!id) questData.created_by = userId

    let url: string
    let method: string
    if (id) {
      url = `${supabaseUrl}/rest/v1/quests?id=eq.${id}`
      method = 'PATCH'
    } else {
      url = `${supabaseUrl}/rest/v1/quests`
      method = 'POST'
    }

    const res = await fetch(url, {
      method,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(questData),
    })

    const result = await res.json()
    return corsResponse(NextResponse.json({ success: true, quest: result?.[0] || result }))
  } catch (error) {
    console.error('Admin quest create/update error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}

/**
 * DELETE /api/quests/admin — delete a quest
 * Body: { id: string }
 */
export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  if (!(await isAdmin(userId))) return corsResponse(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    const { id } = await req.json()
    if (!id) return corsResponse(NextResponse.json({ error: 'id required' }, { status: 400 }))

    await fetch(
      `${supabaseUrl}/rest/v1/quests?id=eq.${id}`,
      {
        method: 'DELETE',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      }
    )

    return corsResponse(NextResponse.json({ success: true }))
  } catch (error) {
    console.error('Admin quest delete error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}
