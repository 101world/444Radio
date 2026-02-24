/**
 * Plugin Chat Sync API
 * GET  /api/plugin/chat - Load synced chat messages
 * PUT  /api/plugin/chat - Save/replace all chat messages (bulk sync)
 * DELETE /api/plugin/chat - Clear all chat messages
 *
 * Uses shared service layer from lib/chat.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticatePlugin } from '@/lib/plugin-auth'
import { createClient } from '@supabase/supabase-js'
import { corsResponse, handleOptions } from '@/lib/cors'
import {
  fetchMessages, bulkReplace, deleteAllMessages, transformRow,
  type ChatInsertPayload,
} from '@/lib/chat'

// Use service role key to bypass RLS (server-side only)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export function OPTIONS() {
  return handleOptions()
}

/**
 * GET - Load all synced chat messages for the plugin user
 */
export async function GET(req: NextRequest) {
  const authResult = await authenticatePlugin(req)
  if (!authResult.valid) {
    return corsResponse(NextResponse.json({ error: authResult.error }, { status: authResult.status }))
  }

  try {
    const { data, error } = await fetchMessages(supabase, authResult.userId)

    if (error) {
      console.error('[plugin/chat] Error fetching messages:', error)
      return corsResponse(NextResponse.json({ error: 'Failed to fetch chat messages' }, { status: 500 }))
    }

    const transformedMessages = (data ?? []).map(transformRow)

    return corsResponse(NextResponse.json({
      success: true,
      messages: transformedMessages,
      count: transformedMessages.length
    }))
  } catch (error) {
    console.error('[plugin/chat] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

/**
 * PUT - Bulk sync: replace all chat messages with the provided array
 * Body: { messages: Array<{ type, content, generationType?, generationId?, result?, stems?, timestamp? }> }
 */
export async function PUT(req: NextRequest) {
  const authResult = await authenticatePlugin(req)
  if (!authResult.valid) {
    return corsResponse(NextResponse.json({ error: authResult.error }, { status: authResult.status }))
  }

  try {
    const body = await req.json()
    const { messages } = body

    if (!Array.isArray(messages)) {
      return corsResponse(NextResponse.json({ error: 'messages must be an array' }, { status: 400 }))
    }

    const { error, rolledBack } = await bulkReplace(
      supabase,
      authResult.userId,
      messages as ChatInsertPayload[]
    )

    if (error) {
      const msg = rolledBack
        ? 'Failed to save messages (rolled back)'
        : (error as { message?: string }).message || 'Sync failed'
      console.error('[plugin/chat] Bulk sync error:', error)
      return corsResponse(NextResponse.json({ error: msg }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({
      success: true,
      count: messages.length
    }))
  } catch (error) {
    console.error('[plugin/chat] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

/**
 * DELETE - Clear all chat messages for the plugin user
 */
export async function DELETE(req: NextRequest) {
  const authResult = await authenticatePlugin(req)
  if (!authResult.valid) {
    return corsResponse(NextResponse.json({ error: authResult.error }, { status: authResult.status }))
  }

  try {
    const { error } = await deleteAllMessages(supabase, authResult.userId)

    if (error) {
      console.error('[plugin/chat] Error clearing messages:', error)
      return corsResponse(NextResponse.json({ error: 'Failed to clear messages' }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({ success: true }))
  } catch (error) {
    console.error('[plugin/chat] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
