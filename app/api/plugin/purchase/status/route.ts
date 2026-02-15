/**
 * Plugin Purchase Status API
 * GET /api/plugin/purchase/status — Check if current user has purchased the plugin
 * 
 * Auth: Clerk session
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/plugin_purchases?clerk_user_id=eq.${encodeURIComponent(userId)}&status=eq.completed&select=id,created_at&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    )

    const data = await res.json()
    const purchased = Array.isArray(data) && data.length > 0

    return corsResponse(NextResponse.json({
      purchased,
      purchasedAt: purchased ? data[0].created_at : null,
    }))
  } catch (error) {
    console.error('[plugin/purchase/status] Error:', error)
    return corsResponse(NextResponse.json({ purchased: false }))
  }
}
