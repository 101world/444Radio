/**
 * Plugin Token Management API
 * 
 * GET  /api/plugin/token - List user's plugin tokens
 * POST /api/plugin/token - Generate new plugin token
 * DELETE /api/plugin/token - Revoke a plugin token
 * 
 * These are called from the WEBSITE (Clerk auth), not the plugin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { generatePluginToken } from '@/lib/plugin-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function OPTIONS() {
  return handleOptions()
}

// GET - List user's plugin tokens
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/plugin_tokens?clerk_user_id=eq.${userId}&select=id,name,is_active,last_used_at,created_at,expires_at&order=created_at.desc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    )

    if (!res.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 }))
    }

    const tokens = await res.json()
    return corsResponse(NextResponse.json({ tokens }))
  } catch (error) {
    console.error('Plugin token list error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

// POST - Generate new plugin token
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json().catch(() => ({}))
    const name = body.name || 'Ableton Plugin'

    // Limit: max 5 active tokens per user
    const countRes = await fetch(
      `${supabaseUrl}/rest/v1/plugin_tokens?clerk_user_id=eq.${userId}&is_active=eq.true&select=id`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    )
    
    const existingTokens = await countRes.json()
    if (Array.isArray(existingTokens) && existingTokens.length >= 5) {
      return corsResponse(NextResponse.json({ error: 'Maximum 5 active tokens allowed. Revoke an existing token first.' }, { status: 400 }))
    }

    // Generate token
    const token = generatePluginToken()

    // Insert
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/plugin_tokens`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        clerk_user_id: userId,
        token,
        name,
        is_active: true,
      }),
    })

    if (!insertRes.ok) {
      console.error('Failed to create token:', await insertRes.text())
      return corsResponse(NextResponse.json({ error: 'Failed to create token' }, { status: 500 }))
    }

    const [created] = await insertRes.json()

    // Return the token ONCE — it won't be shown again
    return corsResponse(NextResponse.json({
      success: true,
      token,  // Show only on creation
      tokenId: created.id,
      name: created.name,
      message: 'Save this token — it will not be shown again. Paste it into your 444 Radio plugin settings in Ableton.'
    }))
  } catch (error) {
    console.error('Plugin token create error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

// DELETE - Revoke a plugin token
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const { tokenId } = body

    if (!tokenId) {
      return corsResponse(NextResponse.json({ error: 'Missing tokenId' }, { status: 400 }))
    }

    // Deactivate (soft delete) — only if owned by user
    const res = await fetch(
      `${supabaseUrl}/rest/v1/plugin_tokens?id=eq.${tokenId}&clerk_user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ is_active: false }),
      }
    )

    if (!res.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to revoke token' }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({ success: true, message: 'Token revoked' }))
  } catch (error) {
    console.error('Plugin token revoke error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
