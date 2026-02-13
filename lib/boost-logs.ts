/**
 * Log every audio boost generation to the boost_logs table.
 * Fire-and-forget — failures are logged but never block the route.
 */

export interface BoostLogParams {
  userId: string
  predictionId?: string | null
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  sourceAudioUrl: string
  trackTitle?: string | null

  // Boost parameters
  bassBoost?: number
  trebleBoost?: number
  volumeBoost?: number
  normalize?: boolean
  noiseReduction?: boolean
  outputFormat?: string
  bitrate?: string

  // Output
  outputAudioUrl?: string | null
  replicateOutputUrl?: string | null
  libraryId?: string | null

  // Credits
  creditsCharged?: number
  creditsRemaining?: number | null

  // Timing (from Replicate metrics)
  replicatePredictTime?: number | null
  replicateTotalTime?: number | null

  // Error
  errorMessage?: string | null
}

export async function logBoostGeneration(params: BoostLogParams): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('⚠️ logBoostGeneration: missing SUPABASE env vars')
      return null
    }

    const body = {
      user_id: params.userId,
      prediction_id: params.predictionId ?? null,
      status: params.status,
      source_audio_url: params.sourceAudioUrl,
      track_title: params.trackTitle ?? null,
      bass_boost: params.bassBoost ?? 0,
      treble_boost: params.trebleBoost ?? 0,
      volume_boost: params.volumeBoost ?? 2,
      normalize: params.normalize ?? true,
      noise_reduction: params.noiseReduction ?? false,
      output_format: params.outputFormat ?? 'mp3',
      bitrate: params.bitrate ?? '192k',
      output_audio_url: params.outputAudioUrl ?? null,
      replicate_output_url: params.replicateOutputUrl ?? null,
      library_id: params.libraryId ?? null,
      credits_charged: params.creditsCharged ?? 0,
      credits_remaining: params.creditsRemaining ?? null,
      replicate_predict_time: params.replicatePredictTime ?? null,
      replicate_total_time: params.replicateTotalTime ?? null,
      error_message: params.errorMessage ?? null,
      completed_at: params.status === 'succeeded' || params.status === 'failed' || params.status === 'canceled'
        ? new Date().toISOString()
        : null,
    }

    console.log('📋 logBoostGeneration:', params.status, params.predictionId || '(no id)')

    const res = await fetch(`${supabaseUrl}/rest/v1/boost_logs`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      console.error('⚠️ Failed to log boost generation:', res.status, text)
      return null
    }

    const saved = await res.json()
    const logId = saved?.[0]?.id || saved?.id || null
    console.log('✅ Boost log saved:', logId)
    return logId
  } catch (err) {
    console.error('⚠️ logBoostGeneration error:', err)
    return null
  }
}

/**
 * Update an existing boost_logs row (e.g., from pending → succeeded)
 */
export async function updateBoostLog(logId: string, updates: Partial<BoostLogParams>): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey || !logId) return

    const body: Record<string, unknown> = {}
    if (updates.predictionId !== undefined) body.prediction_id = updates.predictionId
    if (updates.status !== undefined) body.status = updates.status
    if (updates.outputAudioUrl !== undefined) body.output_audio_url = updates.outputAudioUrl
    if (updates.replicateOutputUrl !== undefined) body.replicate_output_url = updates.replicateOutputUrl
    if (updates.libraryId !== undefined) body.library_id = updates.libraryId
    if (updates.creditsCharged !== undefined) body.credits_charged = updates.creditsCharged
    if (updates.creditsRemaining !== undefined) body.credits_remaining = updates.creditsRemaining
    if (updates.replicatePredictTime !== undefined) body.replicate_predict_time = updates.replicatePredictTime
    if (updates.replicateTotalTime !== undefined) body.replicate_total_time = updates.replicateTotalTime
    if (updates.errorMessage !== undefined) body.error_message = updates.errorMessage
    if (updates.status === 'succeeded' || updates.status === 'failed' || updates.status === 'canceled') {
      body.completed_at = new Date().toISOString()
    }

    if (Object.keys(body).length === 0) return

    const res = await fetch(`${supabaseUrl}/rest/v1/boost_logs?id=eq.${logId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      console.error('⚠️ Failed to update boost log:', res.status, text)
    }
  } catch (err) {
    console.error('⚠️ updateBoostLog error:', err)
  }
}
