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

  try {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase
      .from('studio_projects')
      .select('id, title, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('GET /api/studio/projects error:', JSON.stringify(error, null, 2))
      // Return empty array if table doesn't exist yet
      if (error.message?.includes('relation') || error.code === '42P01') {
        return corsResponse(NextResponse.json({ projects: [], note: 'Table not yet created' }))
      }
      return corsResponse(NextResponse.json({ error: 'Failed to load projects', details: error.message }, { status: 500 }))
    }
    return corsResponse(NextResponse.json({ projects: data || [] }))
  } catch (err: any) {
    console.error('GET /api/studio/projects exception:', err)
    return corsResponse(NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 }))
  }
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const body = await request.json().catch(() => null as any)
    if (!body || !body.title || !body.tracks) {
      console.error('POST /api/studio/projects: Missing required fields', { hasBody: !!body, hasTitle: !!body?.title, hasTracks: !!body?.tracks })
      return corsResponse(NextResponse.json({ error: 'Missing title or tracks' }, { status: 400 }))
    }

    console.log('POST /api/studio/projects: Saving project', { userId, title: body.title, trackCount: body.tracks?.length })

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
        console.error('POST update /api/studio/projects error:', JSON.stringify(error, null, 2))
        return corsResponse(NextResponse.json({ error: 'Failed to update project', details: error.message }, { status: 500 }))
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
        console.error('POST insert /api/studio/projects error:', JSON.stringify(error, null, 2))
        if (error.message?.includes('relation') || error.code === '42P01') {
          return corsResponse(NextResponse.json({ error: 'Database table not created yet. Please run migrations.', details: error.message }, { status: 500 }))
        }
        return corsResponse(NextResponse.json({ error: 'Failed to create project', details: error.message }, { status: 500 }))
      }

      console.log('POST /api/studio/projects: Project created', { projectId: data?.id })
      return corsResponse(NextResponse.json({ success: true, id: data?.id }))
    }
  } catch (err: any) {
    console.error('POST /api/studio/projects exception:', err)
    return corsResponse(NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 }))
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
