/**
 * Studio Generation API
 * Handles multi-track studio AI generation with webhook callbacks
 * 
 * Flow:
 * 1. Client calls POST /api/studio/generate with type + params
 * 2. Server charges credits
 * 3. Creates Replicate prediction with webhook URL
 * 4. Returns jobId to client
 * 5. Replicate calls webhook when done
 * 6. Webhook saves audio and emits WS event
 * 7. Client receives WS event and adds track to timeline
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { corsResponse, handleOptions } from '@/lib/cors'
import { createClient } from '@supabase/supabase-js'

export async function OPTIONS() {
  return handleOptions()
}

// Credit costs for studio operations
const CREDITS_COST = {
  'create-song': 5,        // Full song generation (2-3 min)
  'create-beat': 5,        // Beat/instrumental (30-60s)
  'stem-split': 0,         // Free (as per your requirement)
  'auto-tune': 1,          // Auto-tune effect
  'effects': 1,            // Audio effects chain
} as const

type GenerationType = keyof typeof CREDITS_COST

// Replicate model mappings
const REPLICATE_MODELS = {
  'create-song': 'minimax/music-1.5',
  'create-beat': 'lucataco/ace-step:280fc4f9ee507577f880a167f639c02622421d8fecf492454320311217b688f1',
  'stem-split': 'cjwbw/demucs',
  'auto-tune': 'nateraw/autotune:c45e8f9ae6beb00ba9d498f94e52228b8fcf727a153757dc5c8bc1b7a8788e12',
  'effects': 'smaerdlatigid/stable-audio:6c5f3e69c2e116f7e50f1b58ec9e964e6c5e2bda7ffa0bb21e41f8b4f31d1fc2',
} as const

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const { type, params = {} } = body as { type: GenerationType; params: Record<string, any> }

    if (!CREDITS_COST[type]) {
      return corsResponse(NextResponse.json({ error: 'Invalid generation type' }, { status: 400 }))
    }

    const cost = CREDITS_COST[type]

    // Initialize Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Check and charge credits
    if (cost > 0) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('credits')
        .eq('clerk_user_id', userId)
        .single()

      if (userError || !userData) {
        return corsResponse(NextResponse.json({ error: 'User not found' }, { status: 404 }))
      }

      if (userData.credits < cost) {
        return corsResponse(NextResponse.json({ 
          error: 'Insufficient credits',
          required: cost,
          available: userData.credits
        }, { status: 402 }))
      }

      // Deduct credits
      const { error: deductError } = await supabase
        .from('users')
        .update({ credits: userData.credits - cost })
        .eq('clerk_user_id', userId)

      if (deductError) {
        console.error('Failed to deduct credits:', deductError)
        return corsResponse(NextResponse.json({ error: 'Failed to charge credits' }, { status: 500 }))
      }

      console.log(`💰 Charged ${cost} credits for ${type} (user: ${userId})`)
    }

    // 2. Create job record
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const { error: jobError } = await supabase
      .from('studio_jobs')
      .insert({
        id: jobId,
        user_id: userId,
        type,
        status: 'queued',
        params,
        created_at: new Date().toISOString()
      })

    if (jobError) {
      console.error('Failed to create job:', jobError)
      // Refund credits on error
      if (cost > 0) {
        await supabase
          .from('users')
          .update({ credits: supabase.raw('credits + ?', [cost]) })
          .eq('clerk_user_id', userId)
      }
      return corsResponse(NextResponse.json({ error: 'Failed to create job' }, { status: 500 }))
    }

    // 3. Build Replicate input based on type
    let input: Record<string, any> = {}
    
    switch (type) {
      case 'create-song':
        input = {
          prompt: params.prompt || 'upbeat electronic music 120 bpm',
          lyrics: params.lyrics || '',
          bitrate: 256000,
          sample_rate: 44100,
          audio_format: 'mp3'
        }
        break
      
      case 'create-beat':
        input = {
          tags: params.prompt || 'trap beat 140bpm',
          lyrics: '[inst]', // Instrumental only
          duration: params.duration || 60,
          number_of_steps: params.steps || 60,
          guidance_scale: 15,
          scheduler: 'euler',
          guidance_type: 'apg',
          seed: -1
        }
        break
      
      case 'stem-split':
        input = {
          audio: params.audioUrl,
          output_format: 'mp3',
          stems: 'all'
        }
        break
      
      case 'auto-tune':
        input = {
          audio_file: params.audioUrl,
          scale: params.scale || 'closest',
          pitch_shift: params.pitchShift || 0
        }
        break
      
      case 'effects':
        input = {
          audio_file: params.audioUrl,
          effects: params.effects || []
        }
        break
    }

    // 4. Call Replicate with webhook
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN!
    })

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.444radio.co.in'}/api/studio/webhook`
    
    console.log(`🎵 Creating Replicate prediction for ${type}`)
    console.log(`📡 Webhook URL: ${webhookUrl}`)
    console.log(`🔧 Input:`, input)

    const prediction = await replicate.predictions.create({
      version: REPLICATE_MODELS[type].includes(':') 
        ? REPLICATE_MODELS[type].split(':')[1] 
        : undefined,
      model: REPLICATE_MODELS[type].includes(':') 
        ? undefined 
        : REPLICATE_MODELS[type],
      input,
      webhook: webhookUrl,
      webhook_events_filter: ['completed']
    })

    // 5. Save prediction ID to job
    await supabase
      .from('studio_jobs')
      .update({ 
        replicate_prediction_id: prediction.id,
        status: 'processing'
      })
      .eq('id', jobId)

    console.log(`✅ Job created: ${jobId} → Replicate: ${prediction.id}`)

    // 6. Return job info to client
    return corsResponse(NextResponse.json({
      success: true,
      jobId,
      predictionId: prediction.id,
      status: 'processing',
      creditsCharged: cost
    }))

  } catch (error: any) {
    console.error('Studio generation error:', error)
    return corsResponse(NextResponse.json({
      error: 'Generation failed',
      details: error.message
    }, { status: 500 }))
  }
}
