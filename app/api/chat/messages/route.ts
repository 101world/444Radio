import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { corsResponse, handleOptions } from '@/lib/cors'

/**
 * GET /api/chat/messages
 * Get all chat messages for the authenticated user
 */
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('clerk_user_id', userId)
      .order('timestamp', { ascending: true })

    if (error) {
      console.error('Error fetching chat messages:', error)
      return corsResponse(NextResponse.json({ error: 'Failed to fetch chat messages' }, { status: 500 }))
    }

    // Transform the data to match the frontend Message interface
    const transformedMessages = messages.map(msg => ({
      id: msg.id,
      type: msg.message_type,
      content: msg.content,
      generationType: msg.generation_type,
      generationId: msg.generation_id,
      result: msg.result,
      timestamp: new Date(msg.timestamp),
      isGenerating: false // This will be set by the frontend based on generation queue
    }))

    return corsResponse(NextResponse.json({
      success: true,
      messages: transformedMessages
    }))

  } catch (error) {
    console.error('Error in chat messages API:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

/**
 * POST /api/chat/messages
 * Save a new chat message
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await request.json()
    const { type, content, generationType, generationId, result } = body

    if (!type || !content) {
      return corsResponse(NextResponse.json({ error: 'Missing required fields: type and content' }, { status: 400 }))
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        clerk_user_id: userId,
        message_type: type,
        content,
        generation_type: generationType,
        generation_id: generationId,
        result
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving chat message:', error)
      return corsResponse(NextResponse.json({ error: 'Failed to save chat message' }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({
      success: true,
      message: data
    }))

  } catch (error) {
    console.error('Error in chat messages API:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

/**
 * DELETE /api/chat/messages
 * Clear all chat messages for the user
 */
export async function DELETE() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('clerk_user_id', userId)

    if (error) {
      console.error('Error clearing chat messages:', error)
      return corsResponse(NextResponse.json({ error: 'Failed to clear chat messages' }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({ success: true }))

  } catch (error) {
    console.error('Error in chat messages API:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export function OPTIONS() {
  return handleOptions()
}