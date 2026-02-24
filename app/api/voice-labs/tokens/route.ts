import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/voice-labs/tokens
 * Returns the user's current voice labs token balance and credits.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_voice_token_balance`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_clerk_user_id: userId }),
    })

    if (!res.ok) {
      // Fallback: query directly
      const userRes = await fetch(
        `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=voice_labs_tokens,credits`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      )
      const users = await userRes.json()
      if (!users || users.length === 0) {
        return corsResponse(NextResponse.json({ tokens: 0, credits: 0 }))
      }
      return corsResponse(NextResponse.json({
        tokens: users[0].voice_labs_tokens ?? 0,
        credits: users[0].credits ?? 0,
      }))
    }

    const data = await res.json()
    if (data.success === false) {
      return corsResponse(NextResponse.json({ tokens: 0, credits: 0 }))
    }

    return corsResponse(NextResponse.json({
      tokens: data.tokens ?? 0,
      credits: data.credits ?? 0,
    }))
  } catch (error) {
    console.error('Failed to get token balance:', error)
    return corsResponse(NextResponse.json({ tokens: 0, credits: 0 }))
  }
}
