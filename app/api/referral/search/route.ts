import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() { return handleOptions() }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/referral/search?q=username
 * Search for users by username on 444Radio.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const searchParams = req.nextUrl.searchParams
  const query = searchParams.get('q') || ''

  if (query.length < 2) {
    return corsResponse(NextResponse.json({ users: [] }))
  }

  try {
    // Search users by username (case-insensitive partial match)
    const res = await fetch(
      `${supabaseUrl}/rest/v1/users?username=ilike.*${query}*&select=clerk_user_id,username,referral_code&limit=20`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )

    const users = await res.json()

    return corsResponse(NextResponse.json({
      success: true,
      users: (users || []).map((u: any) => ({
        userId: u.clerk_user_id,
        username: u.username,
        referralCode: u.referral_code,
      })),
    }))
  } catch (error) {
    console.error('User search error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}
