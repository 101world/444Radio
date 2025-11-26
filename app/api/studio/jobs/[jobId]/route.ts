/**
 * Studio Job Status API
 * Poll this endpoint to check job completion
 * Client can poll every 2-3 seconds until status is 'completed' or 'failed'
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const params = await context.params
    const { jobId } = params

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: job, error } = await supabase
      .from('studio_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId) // Security: only owner can view
      .single()

    if (error || !job) {
      return corsResponse(NextResponse.json({ error: 'Job not found' }, { status: 404 }))
    }

    return corsResponse(NextResponse.json({
      jobId: job.id,
      type: job.type,
      status: job.status,
      output: job.output,
      error: job.error,
      createdAt: job.created_at,
      completedAt: job.completed_at
    }))

  } catch (error: any) {
    console.error('Job status error:', error)
    return corsResponse(NextResponse.json({
      error: 'Failed to fetch job status',
      details: error.message
    }, { status: 500 }))
  }
}
