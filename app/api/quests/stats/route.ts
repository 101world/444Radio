import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() { return handleOptions() }

/**
 * GET /api/quests/stats
 * Returns aggregated quest stats for the analytics mini-chart.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    // Active quest passes (total participants)
    const passRes = await fetch(
      `${supabaseUrl}/rest/v1/quest_passes?is_active=eq.true&expires_at=gt.${new Date().toISOString()}&select=id`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: 'count=exact' } }
    )
    const totalParticipants = parseInt(passRes.headers.get('content-range')?.split('/')[1] || '0', 10)

    // Active quests count
    const questsRes = await fetch(
      `${supabaseUrl}/rest/v1/quests?is_active=eq.true&select=id`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: 'count=exact' } }
    )
    const activeQuests = parseInt(questsRes.headers.get('content-range')?.split('/')[1] || '0', 10)

    // Total completions
    const compRes = await fetch(
      `${supabaseUrl}/rest/v1/quest_completions?select=id`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: 'count=exact' } }
    )
    const totalCompletions = parseInt(compRes.headers.get('content-range')?.split('/')[1] || '0', 10)

    // Total started (in-progress)
    const startedRes = await fetch(
      `${supabaseUrl}/rest/v1/user_quests?status=eq.active&select=id`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: 'count=exact' } }
    )
    const totalInProgress = parseInt(startedRes.headers.get('content-range')?.split('/')[1] || '0', 10)

    return corsResponse(NextResponse.json({
      success: true,
      stats: {
        totalParticipants,
        activeQuests,
        totalCompletions,
        totalInProgress,
        completionRate: totalInProgress > 0 ? Math.round((totalCompletions / (totalCompletions + totalInProgress)) * 100) : 0,
      },
    }))
  } catch (error) {
    console.error('Quest stats error:', error)
    return corsResponse(NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 }))
  }
}
