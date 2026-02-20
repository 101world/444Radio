import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() { return handleOptions() }

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
 * GET /api/referral
 * Returns user's referral code and stats.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    // Fetch user's referral code
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=referral_code`,
      { headers: headers() }
    )
    const users = await userRes.json()
    const referralCode = users?.[0]?.referral_code || null

    // Fetch referral stats
    const referralsRes = await fetch(
      `${supabaseUrl}/rest/v1/referrals?referrer_id=eq.${userId}&select=id,is_paid,created_at`,
      { headers: headers() }
    )
    const referrals = await referralsRes.json()

    const totalReferrals = referrals?.length || 0
    const paidReferrals = referrals?.filter((r: any) => r.is_paid)?.length || 0

    return corsResponse(NextResponse.json({
      success: true,
      referralCode,
      totalReferrals,
      paidReferrals,
      referralLink: referralCode ? `https://444radio.co.in/?ref=${referralCode}` : null,
    }))
  } catch (error) {
    console.error('Referral fetch error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}

/**
 * POST /api/referral/apply
 * Apply a referral code during signup/onboarding.
 * Body: { referralCode: string }
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const { referralCode } = await req.json()
    if (!referralCode) {
      return corsResponse(NextResponse.json({ error: 'Referral code required' }, { status: 400 }))
    }

    // Find referrer by code
    const referrerRes = await fetch(
      `${supabaseUrl}/rest/v1/users?referral_code=eq.${referralCode.toUpperCase()}&select=clerk_user_id`,
      { headers: headers() }
    )
    const referrers = await referrerRes.json()
    const referrerId = referrers?.[0]?.clerk_user_id

    if (!referrerId) {
      return corsResponse(NextResponse.json({ error: 'Invalid referral code' }, { status: 404 }))
    }

    if (referrerId === userId) {
      return corsResponse(NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 }))
    }

    // Update user's referred_by
    await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ referred_by: referrerId }),
      }
    )

    // Create referral record
    const referralRes = await fetch(
      `${supabaseUrl}/rest/v1/referrals`,
      {
        method: 'POST',
        headers: { ...headers(), Prefer: 'return=representation,resolution=ignore-duplicates' },
        body: JSON.stringify({
          referrer_id: referrerId,
          referred_id: userId,
          referral_code: referralCode.toUpperCase(),
          is_paid: false,
        }),
      }
    )

    if (!referralRes.ok) {
      throw new Error('Failed to create referral record')
    }

    // Track quest progress for referrer
    const { trackQuestProgress } = await import('@/lib/quest-progress')
    trackQuestProgress(referrerId, 'invite_users').catch(() => {})

    return corsResponse(NextResponse.json({ success: true }))
  } catch (error) {
    console.error('Referral apply error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}
