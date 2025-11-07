import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, description, coverUrl, genre } = await request.json()

    if (!title || title.trim().length < 3) {
      return NextResponse.json({ error: 'Title must be at least 3 characters' }, { status: 400 })
    }

    // Create station
    const { data: station, error } = await supabase
      .from('stations')
      .insert({
        user_id: userId,
        title: title.trim(),
        description: description?.trim() || '',
        cover_url: coverUrl || null,
        genre: genre || 'General',
        is_live: false,
        listener_count: 0,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create station:', error)
      return NextResponse.json({ error: 'Failed to create station' }, { status: 500 })
    }

    return corsResponse(NextResponse.json({ success: true, station }))
  } catch (error) {
    console.error('Create station error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
