/**
 * Plugin Jobs List API
 * GET /api/plugin/jobs - List user's recent plugin generation jobs
 * Auth: Bearer <plugin_token>
 * 
 * Query params:
 *   status - Filter by status: queued, processing, completed, failed
 *   limit  - Max results (default 20, max 100)
 *   type   - Filter by type: music, effects, loops, stems, image, audio-boost
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticatePlugin } from '@/lib/plugin-auth'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(req: NextRequest) {
  const authResult = await authenticatePlugin(req)
  if (!authResult.valid) {
    return corsResponse(NextResponse.json({ error: authResult.error }, { status: authResult.status }))
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))

  try {
    let query = `${supabaseUrl}/rest/v1/plugin_jobs?clerk_user_id=eq.${authResult.userId}&select=id,type,status,credits_cost,output,error,created_at,completed_at&order=created_at.desc&limit=${limit}`

    if (status) query += `&status=eq.${status}`
    if (type) query += `&type=eq.${type}`

    const res = await fetch(query, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    })

    if (!res.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 }))
    }

    const jobs = await res.json()

    return corsResponse(NextResponse.json({
      jobs: jobs.map((j: any) => ({
        jobId: j.id,
        type: j.type,
        status: j.status,
        creditsCost: j.credits_cost,
        output: j.output,
        error: j.error,
        createdAt: j.created_at,
        completedAt: j.completed_at,
      })),
      total: jobs.length,
    }))
  } catch (error) {
    console.error('[plugin/jobs] List error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
