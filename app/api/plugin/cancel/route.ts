/**
 * Plugin Cancel API
 * POST /api/plugin/cancel
 * Auth: Bearer <plugin_token>
 * Body: { jobId, predictionId? }
 * 
 * Cancels an in-progress generation. If predictionId is provided,
 * cancels the Replicate prediction directly. Also marks the plugin job as cancelled.
 */

import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'
import { authenticatePlugin, updatePluginJob } from '@/lib/plugin-auth'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  const authResult = await authenticatePlugin(req)
  if (!authResult.valid) {
    return corsResponse(NextResponse.json({ error: authResult.error }, { status: authResult.status }))
  }

  const body = await req.json().catch(() => ({}))
  const jobId = body.jobId as string
  const predictionId = body.predictionId as string

  if (!jobId && !predictionId) {
    return corsResponse(NextResponse.json({ error: 'Must provide jobId or predictionId' }, { status: 400 }))
  }

  let replicateCancelled = false

  // Cancel Replicate prediction if we have the ID
  if (predictionId) {
    try {
      const replicate = new Replicate({ auth: process.env.REPLICATE_API_KEY_LATEST2! })
      await replicate.predictions.cancel(predictionId)
      replicateCancelled = true
      console.log(`[plugin/cancel] Replicate prediction ${predictionId} cancelled`)
    } catch (e) {
      console.log(`[plugin/cancel] Could not cancel Replicate prediction ${predictionId}:`, e)
    }
  }

  // If jobId provided, also try to get the predictionId from the job
  if (jobId) {
    try {
      // Fetch job to get prediction ID
      const res = await fetch(
        `${supabaseUrl}/rest/v1/plugin_jobs?id=eq.${jobId}&clerk_user_id=eq.${authResult.userId}&select=replicate_prediction_id,status`,
        {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
        }
      )

      if (res.ok) {
        const rows = await res.json()
        const job = rows?.[0]

        if (job && job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') {
          // Cancel Replicate prediction if not already done
          if (job.replicate_prediction_id && !predictionId) {
            try {
              const replicate = new Replicate({ auth: process.env.REPLICATE_API_KEY_LATEST2! })
              await replicate.predictions.cancel(job.replicate_prediction_id)
              replicateCancelled = true
            } catch {}
          }

          // Mark job as cancelled
          await updatePluginJob(jobId, { status: 'cancelled', error: 'Cancelled by user' })
        }
      }
    } catch (e) {
      console.error('[plugin/cancel] Error updating job:', e)
    }
  }

  return corsResponse(NextResponse.json({
    success: true,
    cancelled: true,
    replicateCancelled,
    jobId: jobId || null,
  }))
}
