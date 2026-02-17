/**
 * Plugin Chat Sync API
 * GET  /api/plugin/chat - Load synced chat messages
 * PUT  /api/plugin/chat - Save/replace all chat messages (bulk sync)
 * DELETE /api/plugin/chat - Clear all chat messages
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticatePlugin } from '@/lib/plugin-auth'
import { createClient } from '@supabase/supabase-js'
import { corsResponse, handleOptions } from '@/lib/cors'

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
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('clerk_user_id', authResult.userId)
      .order('timestamp', { ascending: true })

    if (error) {
      console.error('[plugin/chat] Error fetching messages:', error)
      return corsResponse(NextResponse.json({ error: 'Failed to fetch chat messages' }, { status: 500 }))
    }

    // Transform to match the frontend Message interface
    const transformedMessages = (messages || []).map(msg => {
      // Extract stems from result._stems if present
      const result = msg.result as Record<string, unknown> | null
      const stems = result?._stems as Record<string, string> | undefined
      const cleanResult = result ? { ...result } : null
      if (cleanResult) delete cleanResult._stems
      return {
        id: msg.id,
        type: msg.message_type,
        content: msg.content,
        generationType: msg.generation_type,
        generationId: msg.generation_id,
        result: cleanResult && Object.keys(cleanResult).length > 0 ? cleanResult : undefined,
        stems,
        timestamp: msg.timestamp,
        isGenerating: false
      }
    })

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
 * Body: { messages: Array<{ type, content, generationType?, generationId?, result?, timestamp? }> }
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

    // Delete existing messages for this user
    const { error: deleteError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('clerk_user_id', authResult.userId)

    if (deleteError) {
      console.error('[plugin/chat] Error clearing old messages:', deleteError)
      return corsResponse(NextResponse.json({ error: 'Failed to clear old messages' }, { status: 500 }))
    }

    // Insert all new messages if any
    if (messages.length > 0) {
      const rows = messages.map((msg: {
        type: string
        content: string
        generationType?: string
        generationId?: string
        result?: Record<string, unknown>
        stems?: Record<string, string>
        timestamp?: string
      }) => {
        // Merge stems into result JSONB so they survive round-trip
        const resultData = msg.result || (msg.stems ? {} : null)
        if (msg.stems && resultData) {
          (resultData as Record<string, unknown>)._stems = msg.stems
        }
        return {
          clerk_user_id: authResult.userId,
          message_type: msg.type,
          content: msg.content,
          generation_type: msg.generationType || null,
          generation_id: msg.generationId || null,
          result: resultData,
          timestamp: msg.timestamp || new Date().toISOString()
        }
      })

      const { error: insertError } = await supabase
        .from('chat_messages')
        .insert(rows)

      if (insertError) {
        console.error('[plugin/chat] Error inserting messages:', insertError)
        return corsResponse(NextResponse.json({ error: 'Failed to save messages' }, { status: 500 }))
      }
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
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('clerk_user_id', authResult.userId)

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
