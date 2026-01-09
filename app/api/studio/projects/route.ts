import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

export function OPTIONS() {
  return handleOptions()
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const supabase = getAdminSupabase()
  const { data, error } = await supabase
    .from('studio_projects')
    .select('id, title, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('GET /api/studio/projects error', error)
    return corsResponse(NextResponse.json({ error: 'Failed to load projects' }, { status: 500 }))
  }
  return corsResponse(NextResponse.json({ projects: data || [] }))
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const body = await request.json().catch(() => null as any)
  if (!body || !body.title || !body.tracks) {
    return corsResponse(NextResponse.json({ error: 'Missing title or tracks' }, { status: 400 }))
  }

  const supabase = getAdminSupabase()

  if (body.id) {
    // Update existing
    const { error } = await supabase
      .from('studio_projects')
      .update({ 
        title: body.title, 
        tracks: body.tracks, 
        tempo: body.tempo || 120 
      })
      .eq('id', body.id)
      .eq('user_id', userId)

    if (error) {
      console.error('POST update /api/studio/projects error', error)
      return corsResponse(NextResponse.json({ error: 'Failed to update project' }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({ success: true, id: body.id }))
  } else {
    // Create new
    const { data, error } = await supabase
      .from('studio_projects')
      .insert({ 
        title: body.title, 
        tracks: body.tracks, 
        tempo: body.tempo || 120, 
        user_id: userId 
      })
      .select('id')
      .single()

    if (error) {
      console.error('POST insert /api/studio/projects error', error)
      return corsResponse(NextResponse.json({ error: 'Failed to create project' }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({ success: true, id: data?.id }))
  }
}

export async function DELETE(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return corsResponse(NextResponse.json({ error: 'Missing id' }, { status: 400 }))
  }
  const supabase = getAdminSupabase()
  const { error } = await supabase
    .from('studio_projects')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('DELETE /api/studio/projects error', error)
    return corsResponse(NextResponse.json({ error: 'Failed to delete project' }, { status: 500 }))
  }
  return corsResponse(NextResponse.json({ success: true }))
}
