import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env for server-side access')
  }
  return createClient(url, serviceRoleKey)
}

function isMissingColumn(error: any) {
  return error?.code === '42703' || /column .* does not exist/i.test(error?.message || '')
}

function isRLSPolicyError(error: any) {
  return error?.code === '42501' || /row[- ]level security/i.test(error?.message || '')
}

function mapLegacyProjects(data: any[]) {
  return (data || []).map((item) => ({
    id: item.id,
    title: item.name,
    tracks: Array.isArray(item.data?.tracks) ? item.data.tracks : item.data || [],
    tempo:
      typeof item.data?.tempo === 'number'
        ? item.data.tempo
        : typeof item.data?.bpm === 'number'
        ? item.data.bpm
        : 120,
    updated_at: item.updated_at
  }))
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
      .select('id, title, updated_at, tracks, tempo')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('GET /api/studio/projects error:', JSON.stringify(error, null, 2))
      if (error.message?.includes('relation') || error.code === '42P01') {
        return corsResponse(NextResponse.json({ projects: [], note: 'Table not yet created' }))
      }
      if (isRLSPolicyError(error)) {
        return corsResponse(
          NextResponse.json(
            {
              error: 'Database permissions blocked the request',
              details: 'Supabase RLS denied access. Ensure SUPABASE_SERVICE_ROLE_KEY is set on the server.'
            },
            { status: 403 }
          )
        )
      }
      if (isMissingColumn(error)) {
        // Legacy schema fallback (name/data + clerk_user_id)
        const { data: legacyData, error: legacyError } = await supabase
          .from('studio_projects')
          .select('id, name, data, updated_at')
          .eq('clerk_user_id', userId)
          .order('updated_at', { ascending: false })

        if (legacyError) {
          console.error('GET /api/studio/projects legacy fallback error:', JSON.stringify(legacyError, null, 2))
          return corsResponse(
            NextResponse.json(
              { error: 'Failed to load projects', details: legacyError.message },
              { status: 500 }
            )
          )
        }

        return corsResponse(NextResponse.json({ projects: mapLegacyProjects(legacyData) }))
      }
      return corsResponse(
        NextResponse.json({ error: 'Failed to load projects', details: error.message }, { status: 500 })
      )
    }
    return corsResponse(NextResponse.json({ projects: data || [] }))
  } catch (err: any) {
    console.error('GET /api/studio/projects exception:', err)
    if (err?.message?.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return corsResponse(
        NextResponse.json(
          {
            error: 'Server configuration error',
            details: 'SUPABASE_SERVICE_ROLE_KEY is missing. Set it in Vercel env vars to enable studio projects.'
          },
          { status: 500 }
        )
      )
    }
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
      // Update existing (new schema)
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
        if (isRLSPolicyError(error)) {
          return corsResponse(
            NextResponse.json(
              {
                error: 'Database permissions blocked the request',
                details: 'Supabase RLS denied access. Ensure SUPABASE_SERVICE_ROLE_KEY is set on the server.'
              },
              { status: 403 }
            )
          )
        }
        if (isMissingColumn(error)) {
          // Legacy schema fallback (name/data + clerk_user_id)
          const { error: legacyError } = await supabase
            .from('studio_projects')
            .update({
              name: body.title,
              data: { tracks: body.tracks, tempo: body.tempo || 120 }
            })
            .eq('id', body.id)
            .eq('clerk_user_id', userId)

          if (legacyError) {
            console.error('POST update legacy /api/studio/projects error:', JSON.stringify(legacyError, null, 2))
            return corsResponse(
              NextResponse.json({ error: 'Failed to update project', details: legacyError.message }, { status: 500 })
            )
          }

          return corsResponse(NextResponse.json({ success: true, id: body.id }))
        }
        return corsResponse(
          NextResponse.json({ error: 'Failed to update project', details: error.message }, { status: 500 })
        )
      }

      return corsResponse(NextResponse.json({ success: true, id: body.id }))
    } else {
      // Create new (new schema)
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
          return corsResponse(
            NextResponse.json(
              { error: 'Database table not created yet. Please run migrations.', details: error.message },
              { status: 500 }
            )
          )
        }

        if (isRLSPolicyError(error)) {
          return corsResponse(
            NextResponse.json(
              {
                error: 'Database permissions blocked the request',
                details: 'Supabase RLS denied access. Ensure SUPABASE_SERVICE_ROLE_KEY is set on the server.'
              },
              { status: 403 }
            )
          )
        }

        if (isMissingColumn(error)) {
          // Legacy schema fallback (name/data + clerk_user_id)
          const { data: legacyData, error: legacyError } = await supabase
            .from('studio_projects')
            .insert({
              name: body.title,
              data: { tracks: body.tracks, tempo: body.tempo || 120 },
              clerk_user_id: userId
            })
            .select('id')
            .single()

          if (legacyError) {
            console.error('POST insert legacy /api/studio/projects error:', JSON.stringify(legacyError, null, 2))
            return corsResponse(
              NextResponse.json(
                { error: 'Failed to create project', details: legacyError.message },
                { status: 500 }
              )
            )
          }

          console.log('POST /api/studio/projects: Project created (legacy)', { projectId: legacyData?.id })
          return corsResponse(NextResponse.json({ success: true, id: legacyData?.id }))
        }

        return corsResponse(NextResponse.json({ error: 'Failed to create project', details: error.message }, { status: 500 }))
      }

      console.log('POST /api/studio/projects: Project created', { projectId: data?.id })
      return corsResponse(NextResponse.json({ success: true, id: data?.id }))
    }
  } catch (err: any) {
    console.error('POST /api/studio/projects exception:', err)
    if (err?.message?.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return corsResponse(
        NextResponse.json(
          {
            error: 'Server configuration error',
            details: 'SUPABASE_SERVICE_ROLE_KEY is missing. Set it in Vercel env vars to enable studio projects.'
          },
          { status: 500 }
        )
      )
    }
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
    if (isRLSPolicyError(error)) {
      return corsResponse(
        NextResponse.json(
          {
            error: 'Database permissions blocked the request',
            details: 'Supabase RLS denied access. Ensure SUPABASE_SERVICE_ROLE_KEY is set on the server.'
          },
          { status: 403 }
        )
      )
    }
    if (isMissingColumn(error)) {
      const { error: legacyError } = await supabase
        .from('studio_projects')
        .delete()
        .eq('id', id)
        .eq('clerk_user_id', userId)

      if (legacyError) {
        console.error('DELETE legacy /api/studio/projects error', legacyError)
        return corsResponse(NextResponse.json({ error: 'Failed to delete project' }, { status: 500 }))
      }

      return corsResponse(NextResponse.json({ success: true }))
    }

    return corsResponse(NextResponse.json({ error: 'Failed to delete project' }, { status: 500 }))
  }
  return corsResponse(NextResponse.json({ success: true }))
}
