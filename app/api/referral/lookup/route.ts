import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() { return handleOptions() }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/referral/lookup?q=username
 * Public endpoint — no auth required.
 * Searches for users by username so new sign-ups can find a referrer.
 * Returns minimal info: username + referral code only.
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || ''

  if (query.length < 2) {
    return corsResponse(NextResponse.json({ users: [] }))
  }

  try {
    // Sanitize the query for use in PostgREST ilike filter
    const sanitized = query.replace(/[^a-zA-Z0-9_.-]/g, '')
    if (sanitized.length < 2) {
      return corsResponse(NextResponse.json({ users: [] }))
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/users?username=ilike.*${sanitized}*&select=username,referral_code&limit=10`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )

    if (!res.ok) {
      console.error('Referral lookup error:', await res.text())
      return corsResponse(NextResponse.json({ users: [] }))
    }

    const users = await res.json()

    return corsResponse(NextResponse.json({
      users: (users || [])
        .filter((u: any) => u.username && u.referral_code)
        .map((u: any) => ({
          username: u.username,
          referralCode: u.referral_code,
        })),
    }))
  } catch (error) {
    console.error('Referral lookup error:', error)
    return corsResponse(NextResponse.json({ users: [] }))
  }
}
