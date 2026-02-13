/**
 * Plugin Job Status API
 * GET /api/plugin/jobs/[jobId] - Poll job status from the plugin
 * Auth: Bearer <plugin_token>
 * 
 * The plugin polls this every 2-3s after calling /api/plugin/generate.
 * Returns the job status, output (when complete), or error (on failure).
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticatePlugin } from '@/lib/plugin-auth'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const authResult = await authenticatePlugin(req)
  if (!authResult.valid) {
    return corsResponse(NextResponse.json({ error: authResult.error }, { status: authResult.status }))
  }

  const { jobId } = await context.params

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/plugin_jobs?id=eq.${jobId}&clerk_user_id=eq.${authResult.userId}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    )

    if (!res.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 }))
    }

    const rows = await res.json()
    const job = rows?.[0]

    if (!job) {
      return corsResponse(NextResponse.json({ error: 'Job not found' }, { status: 404 }))
    }

    return corsResponse(NextResponse.json({
      jobId: job.id,
      type: job.type,
      status: job.status,
      creditsCost: job.credits_cost,
      output: job.output,
      error: job.error,
      createdAt: job.created_at,
      completedAt: job.completed_at,
    }))
  } catch (error) {
    console.error('[plugin/jobs] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
