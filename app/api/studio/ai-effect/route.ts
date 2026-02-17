/**
 * AI Effect API - Audio effects using Replicate stable-audio
 * Generates audio effects based on prompts
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Replicate from 'replicate';
import { corsResponse, handleOptions } from '@/lib/cors';
import { createClient } from '@supabase/supabase-js';
import { logCreditTransaction } from '@/lib/credit-transactions';
import { refundCredits } from '@/lib/refund-credits';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: Request) {
  let deductedAmount = 0
  let deductedUserId: string | null = null
  try {
    const { userId } = await auth();
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
    }

    const { audioUrl, prompt, trackId, trackName } = await request.json();

    if (!audioUrl || !prompt) {
      return corsResponse(
        NextResponse.json({ error: 'Audio URL and prompt required' }, { status: 400 })
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Deduct credits atomically BEFORE generation (0.5 credits)
    const { data: deductResult, error: deductErr } = await supabaseAdmin.rpc('deduct_credits', {
      p_clerk_user_id: userId,
      p_amount: 1, // RPC uses integer — we use 1 as minimum unit
      p_type: 'generation_effects',
      p_description: `AI effect generation: ${prompt?.slice(0, 50)}`,
      p_metadata: { generation_type: 'ai-effect', prompt: prompt?.slice(0, 100), trackId, trackName }
    });

    const row = deductResult?.[0] || deductResult;
    if (deductErr || !row?.success) {
      return corsResponse(
        NextResponse.json({ error: row?.error_message || 'Insufficient credits' }, { status: 402 })
      );
    }
    deductedAmount = 1
    deductedUserId = userId

    // Initialize Replicate
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_KEY_LATEST2!,
    });

    // Create music generation prediction
    const prediction = await replicate.predictions.create({
      version: "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
      input: {
        prompt: `Audio effect: ${prompt}`,
        duration: 10,
        model_version: "stereo-large",
      }
    });

    // Wait for completion (60 second timeout)
    let result = prediction;
    const startTime = Date.now();
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      if (Date.now() - startTime > 60000) {
        throw new Error('AI effect generation timed out');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      result = await replicate.predictions.get(result.id);
    }

    if (result.status === 'failed') {
      throw new Error('AI effect generation failed');
    }

    const output = result.output as string;
    if (!output) {
      throw new Error('No output from stable-audio model');
    }

    // Save effect to combined_media table for library access
    const { data: savedEffect, error: saveError } = await supabaseAdmin
      .from('combined_media')
      .insert({
        user_id: userId,
        type: 'effect',
        title: `AI Effect: ${prompt.substring(0, 50)}`,
        audio_url: output,
        is_public: false,
        genre: 'effects',
        metadata: {
          prompt,
          trackId,
          trackName,
          generatedAt: new Date().toISOString(),
        },
        plays: 0,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save effect to library:', saveError);
    }

    return corsResponse(
      NextResponse.json({
        success: true,
        audioUrl: output,
        effectId: savedEffect?.id,
        message: 'AI effect generated and saved to library',
        creditsRemaining: row.new_credits,
      })
    );

  } catch (error) {
    console.error('AI effect error:', error);
    // Refund if credits were already deducted
    if (deductedAmount > 0 && deductedUserId) {
      await refundCredits({ userId: deductedUserId, amount: deductedAmount, type: 'generation_effects', reason: `AI effect error: ${error instanceof Error ? error.message.substring(0, 80) : 'unknown'}`, metadata: { error: String(error).substring(0, 200) } }).catch(() => {})
    }
    return corsResponse(
      NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'AI effect generation failed',
          success: false 
        },
        { status: 500 }
      )
    );
  }
}
