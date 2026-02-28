import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

// GET — fetch all public patterns
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('patterns')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Failed to fetch patterns:', error)
      return corsResponse(NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({ success: true, patterns: data || [] }))
  } catch (err) {
    console.error('Patterns GET error:', err)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

// POST — create a new pattern
export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await request.json()
    const { title, description, code, genre } = body

    if (!title || !code) {
      return corsResponse(NextResponse.json({ error: 'Title and code are required' }, { status: 400 }))
    }

    if (title.length > 100) {
      return corsResponse(NextResponse.json({ error: 'Title must be 100 characters or less' }, { status: 400 }))
    }

    if (code.length > 5000) {
      return corsResponse(NextResponse.json({ error: 'Pattern code must be 5000 characters or less' }, { status: 400 }))
    }

    // Get username from users table
    const { data: userData } = await supabase
      .from('users')
      .select('username')
      .eq('clerk_user_id', userId)
      .single()

    const { data, error } = await supabase
      .from('patterns')
      .insert({
        user_id: userId,
        username: userData?.username || 'Anonymous',
        title: title.trim(),
        description: (description || '').trim(),
        code: code.trim(),
        genre: genre || null,
        is_public: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create pattern:', error)
      return corsResponse(NextResponse.json({ error: 'Failed to create pattern' }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({ success: true, pattern: data }))
  } catch (err) {
    console.error('Patterns POST error:', err)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
