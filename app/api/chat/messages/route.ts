import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { corsResponse, handleOptions } from '@/lib/cors'
import {
  fetchMessages, insertMessage, deleteAllMessages, updateMessage,
  bulkReplace, transformRow,
  type ChatInsertPayload,
} from '@/lib/chat'

// ── Shared helpers ──
type ApiHandler = (userId: string, request?: NextRequest) => Promise<NextResponse>

/** Wraps auth check + try/catch + CORS for every handler */
function withAuth(handler: ApiHandler) {
  return async (request?: NextRequest) => {
    try {
      const { userId } = await auth()
      if (!userId) {
        return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      }
      return corsResponse(await handler(userId, request))
    } catch (error) {
      console.error('Chat messages API error:', error)
      return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
    }
  }
}

// ── GET /api/chat/messages?limit=200&before=<ISO>&after=<ISO> ──
export const GET = withAuth(async (userId, request) => {
  const url = request ? new URL(request.url) : null
  const limit = Number(url?.searchParams.get('limit')) || 200
  const before = url?.searchParams.get('before') || null
  const after = url?.searchParams.get('after') || null

  const { data, error, hasMore } = await fetchMessages(supabase, userId, { limit, before, after })
  if (error) {
    console.error('Fetch messages error:', error)
    return NextResponse.json({ error: 'Failed to fetch chat messages' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    messages: (data ?? []).map(transformRow),
    hasMore,
  })
})

// ── POST /api/chat/messages — append a single message ──
export const POST = withAuth(async (userId, request) => {
  const body = await request!.json()
  const { type, content, generationType, generationId, result } = body

  if (!type || !content) {
    return NextResponse.json({ error: 'Missing required fields: type and content' }, { status: 400 })
  }

  const { data, error } = await insertMessage(supabase, userId, {
    type, content,
    generationType: generationType ?? null,
    generationId: generationId ?? null,
    result: result ?? null,
  })

  if (error) {
    console.error('Save message error:', error)
    return NextResponse.json({ error: 'Failed to save chat message' }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: data ? transformRow(data) : null })
})

// ── PATCH /api/chat/messages — update a single message by id ──
export const PATCH = withAuth(async (userId, request) => {
  const { id: messageId, ...patch } = await request!.json()
  if (!messageId) {
    return NextResponse.json({ error: 'Missing message id' }, { status: 400 })
  }

  const { data, error } = await updateMessage(supabase, userId, messageId, patch)
  if (error) {
    console.error('Update message error:', error)
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: data ? transformRow(data) : null })
})

// ── DELETE /api/chat/messages — clear all ──
export const DELETE = withAuth(async (userId) => {
  const { error } = await deleteAllMessages(supabase, userId)
  if (error) {
    console.error('Clear messages error:', error)
    return NextResponse.json({ error: 'Failed to clear chat messages' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
})

// ── PUT /api/chat/messages — bulk sync (plugin compat + legacy) ──
export const PUT = withAuth(async (userId, request) => {
  const { messages } = await request!.json()

  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: 'messages must be an array' }, { status: 400 })
  }

  const { error, rolledBack } = await bulkReplace(
    supabase, userId,
    messages as ChatInsertPayload[]
  )

  if (error) {
    const msg = rolledBack ? 'Failed to save messages (rolled back)' : (error as { message?: string }).message || 'Sync failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ success: true, count: messages.length })
})

export function OPTIONS() {
  return handleOptions()
}