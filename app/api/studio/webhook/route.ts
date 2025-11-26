/**
 * Replicate Webhook Handler
 * Receives completion events from Replicate predictions
 * Saves generated audio and broadcasts to WebSocket clients
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsResponse, handleOptions } from '@/lib/cors'
import { uploadToR2 } from '@/lib/r2-upload'
import { broadcastJobCompleted, broadcastJobFailed, broadcastJobProgress } from '@/lib/pusher-server'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  try {
    const webhook = await req.json()
    
    console.log('📨 Received webhook from Replicate:', {
      id: webhook.id,
      status: webhook.status,
      hasOutput: !!webhook.output
    })

    // Only process completed predictions
    if (webhook.status !== 'succeeded') {
      console.log(`⏭️ Skipping webhook with status: ${webhook.status}`)
      return corsResponse(NextResponse.json({ ok: true, skipped: true }))
    }

    const predictionId = webhook.id
    const output = webhook.output

    if (!output) {
      console.error('❌ Webhook has no output')
      return corsResponse(NextResponse.json({ error: 'No output' }, { status: 400 }))
    }

    // Initialize Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Find the job by prediction ID
    const { data: job, error: jobError } = await supabase
      .from('studio_jobs')
      .select('*')
      .eq('replicate_prediction_id', predictionId)
      .single()

    if (jobError || !job) {
      console.error('❌ Job not found for prediction:', predictionId)
      return corsResponse(NextResponse.json({ error: 'Job not found' }, { status: 404 }))
    }

    console.log(`✅ Found job: ${job.id} (type: ${job.type})`)

    // Process output based on job type
    let audioUrls: Record<string, string> = {}
    
    if (job.type === 'stem-split') {
      // Stem split returns multiple audio files
      if (typeof output === 'object' && !Array.isArray(output)) {
        audioUrls = output as Record<string, string>
      } else if (Array.isArray(output)) {
        // Convert array to object
        output.forEach((url: string, idx: number) => {
          audioUrls[`stem${idx + 1}`] = url
        })
      }
    } else {
      // Single audio file
      const audioUrl = Array.isArray(output) ? output[0] : (typeof output === 'string' ? output : output.audio || output.url)
      audioUrls['audio'] = audioUrl
    }

    console.log(`📦 Processing ${Object.keys(audioUrls).length} audio file(s)`)

    // Upload all audio files to R2 for permanent storage
    const uploadedUrls: Record<string, string> = {}
    
    for (const [key, replicateUrl] of Object.entries(audioUrls)) {
      try {
        console.log(`⬆️ Uploading ${key} to R2...`)
        
        // Download from Replicate
        const response = await fetch(replicateUrl)
        if (!response.ok) {
          throw new Error(`Failed to download: ${response.status}`)
        }
        
        const blob = await response.blob()
        const fileName = `${job.id}_${key}_${Date.now()}.mp3`
        const file = new File([blob], fileName, { type: 'audio/mpeg' })
        
        // Upload to R2
        const uploadResult = await uploadToR2(file, 'audio-files', fileName)
        
        if (!uploadResult.success || !uploadResult.url) {
          throw new Error(uploadResult.error || 'Upload failed')
        }
        
        uploadedUrls[key] = uploadResult.url
        console.log(`✅ Uploaded ${key}: ${uploadResult.url}`)
        
      } catch (uploadError) {
        console.error(`❌ Failed to upload ${key}:`, uploadError)
        // Continue with other files
      }
    }

    if (Object.keys(uploadedUrls).length === 0) {
      console.error('❌ No files were uploaded successfully')
      const errorMsg = 'Failed to upload audio files'
      
      await supabase
        .from('studio_jobs')
        .update({ 
          status: 'failed',
          error: errorMsg,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
      
      // Broadcast failure to client
      await broadcastJobFailed(job.user_id, {
        jobId: job.id,
        error: errorMsg
      })
      
      return corsResponse(NextResponse.json({ error: 'Upload failed' }, { status: 500 }))
    }

    // Update job with results
    await supabase
      .from('studio_jobs')
      .update({
        status: 'completed',
        output: uploadedUrls,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id)

    console.log(`✅ Job completed: ${job.id}`)

    // Broadcast to client via Pusher (real-time WebSocket alternative)
    await broadcastJobCompleted(job.user_id, {
      jobId: job.id,
      type: job.type,
      output: uploadedUrls
    })

    return corsResponse(NextResponse.json({
      success: true,
      jobId: job.id,
      output: uploadedUrls
    }))

  } catch (error: any) {
    console.error('❌ Webhook processing error:', error)
    return corsResponse(NextResponse.json({
      error: 'Webhook processing failed',
      details: error.message
    }, { status: 500 }))
  }
}
