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
  'create-song': 2,        // Music generation with minimax/music-1.5
  'create-beat': 16,       // Instrumental with stable-audio-2.5
  'stem-split': 20,        // Stem splitter with demucs
  'auto-tune': 1,          // Auto-tune effect
  'effects': 0.1,          // Audio effects chain (stable-audio)
} as const

type GenerationType = keyof typeof CREDITS_COST

// Replicate model mappings
const REPLICATE_MODELS = {
  'create-song': 'minimax/music-1.5',
  'create-beat': 'stability-ai/stable-audio-2.5',
  'stem-split': 'cjwbw/demucs',
  'auto-tune': 'nateraw/autotune',
  'effects': 'smaerdlatigid/stable-audio',
} as const

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    // Support both old format (type, params) and new format (type, prompt, model)
    let type = body.type
    let params = body.params || {}
    
    // Handle new format from multi-track UI
    if (body.prompt) {
      params.prompt = body.prompt
    }
    if (body.model) {
      // Map UI model selection to type
      if (body.model.includes('music')) type = 'create-song'
      else if (body.model.includes('beat') || body.model.includes('ace')) type = 'create-beat'
    }
    if (!type) type = 'create-song' // Default to song generation
    
    const generationType = type as GenerationType

    if (!CREDITS_COST[generationType]) {
      return corsResponse(NextResponse.json({ error: 'Invalid generation type' }, { status: 400 }))
    }

    const cost = CREDITS_COST[generationType]

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

      console.log(`💰 Charged ${cost} credits for ${generationType} (user: ${userId})`)
    }

    // 2. Create job record
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const { error: jobError } = await supabase
      .from('studio_jobs')
      .insert({
        id: jobId,
        user_id: userId,
        type: generationType,
        status: 'queued',
        params,
        created_at: new Date().toISOString()
      })

    if (jobError) {
      console.error('Failed to create job:', jobError)
      // Refund credits on error
      if (cost > 0) {
        const { data: userData } = await supabase
          .from('users')
          .select('credits')
          .eq('clerk_user_id', userId)
          .single()
        
        if (userData) {
          await supabase
            .from('users')
            .update({ credits: userData.credits + cost })
            .eq('clerk_user_id', userId)
        }
      }
      return corsResponse(NextResponse.json({ error: 'Failed to create job' }, { status: 500 }))
    }

    // 3. Build Replicate input based on type
    let input: Record<string, any> = {}
    
    switch (generationType) {
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
          prompt: params.prompt || 'instrumental trap beat 140bpm',
          duration: params.duration || 60,
          audio_start: params.audioStart || 0,
          audio_end: params.audioEnd || 60,
          seed: params.seed || -1
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
    
    console.log(`🎵 Creating Replicate prediction for ${generationType}`)
    console.log(`📡 Webhook URL: ${webhookUrl}`)
    console.log(`🔧 Input:`, input)

    const modelString = REPLICATE_MODELS[generationType]
    const isVersion = modelString.includes(':')
    
    const prediction = await replicate.predictions.create({
      ...(isVersion 
        ? { version: modelString.split(':')[1] }
        : { model: modelString }
      ),
      input,
      webhook: webhookUrl,
      webhook_events_filter: ['completed']
    } as any)

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
