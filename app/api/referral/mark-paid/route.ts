import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() { return handleOptions() }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * POST /api/referral/mark-paid
 * Mark a referred user as paid (called when they make first purchase).
 * Body: { userId: string }
 */
export async function POST(req: NextRequest) {
  const { userId: callerId } = await auth()
  if (!callerId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const { userId } = await req.json()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'userId required' }, { status: 400 }))
    }

    // Update referral record to mark as paid
    await fetch(
      `${supabaseUrl}/rest/v1/referrals?referred_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_paid: true }),
      }
    )

    return corsResponse(NextResponse.json({ success: true }))
  } catch (error) {
    console.error('Mark paid error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}
