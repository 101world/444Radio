/**
 * Auto-Tune API - Pitch correction using Replicate nateraw/autotune
 * Applies pitch correction to audio and returns processed URL
 * Cost: 0.5 credits per generation
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Replicate from 'replicate';
import { corsResponse, handleOptions } from '@/lib/cors';
import { createClient } from '@supabase/supabase-js';
import { logCreditTransaction } from '@/lib/credit-transactions';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
    }

    const { audioUrl, scale = 'C:maj', outputFormat = 'wav' } = await request.json();

    if (!audioUrl) {
      return corsResponse(
        NextResponse.json({ error: 'Audio URL required' }, { status: 400 })
      );
    }

    // Initialize Supabase for credits
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Deduct credits atomically (1 credit for autotune)
    const { data: deductResult, error: deductErr } = await supabase.rpc('deduct_credits', {
      p_clerk_user_id: userId,
      p_amount: 1,
      p_type: 'generation_audio_boost',
      p_description: 'Studio auto-tune processing',
      p_metadata: { generation_type: 'autotune', scale }
    });

    const deductRow = deductResult?.[0] || deductResult;
    if (deductErr || !deductRow?.success) {
      return corsResponse(
        NextResponse.json({ error: deductRow?.error_message || 'Insufficient credits' }, { status: 402 })
      );
    }

    // Initialize Replicate
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_KEY_LATEST2!,
    });

    console.log('🎤 Auto-tuning:', { scale, outputFormat });

    // Create autotune prediction
    const prediction = await replicate.predictions.create({
      model: "nateraw/autotune",
      input: {
        audio: audioUrl,
        scale,
        output_format: outputFormat,
      }
    });

    // Wait for completion (60 second timeout)
    let result = prediction;
    const startTime = Date.now();
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      if (Date.now() - startTime > 60000) {
        // Refund credits on timeout
        await supabase
          .from('users')
          .update({ credits: (deductRow.new_credits || 0) + 1 })
          .eq('clerk_user_id', userId);
        
        return corsResponse(
          NextResponse.json({ success: false, error: 'Auto-tune timeout' }, { status: 408 })
        );
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      result = await replicate.predictions.get(result.id);
    }

    if (result.status === 'failed') {
      // Refund credits on failure
      await supabase
        .from('users')
        .update({ credits: (deductRow.new_credits || 0) + 1 })
        .eq('clerk_user_id', userId);
      
      return corsResponse(
        NextResponse.json({ success: false, error: result.error || 'Auto-tune failed' }, { status: 500 })
      );
    }

    // Extract audio URL
    const outputUrl = typeof result.output === 'string' 
      ? result.output 
      : Array.isArray(result.output) 
        ? result.output[0] 
        : result.output?.audio || result.output?.url;

    if (!outputUrl) {
      // Refund on missing output
      await supabase
        .from('users')
        .update({ credits: (deductRow.new_credits || 0) + 1 })
        .eq('clerk_user_id', userId);
      
      return corsResponse(
        NextResponse.json({ success: false, error: 'No output URL', raw: result.output }, { status: 502 })
      );
    }

    console.log('✅ Auto-tune complete:', outputUrl);

    return corsResponse(
      NextResponse.json({
        success: true,
        audioUrl: outputUrl,
        remainingCredits: deductRow.new_credits,
        metadata: { scale, outputFormat, predictionId: result.id }
      })
    );

  } catch (error) {
    console.error('❌ Auto-tune error:', error);
    return corsResponse(
      NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Auto-tune failed' }, { status: 500 })
    );
  }
}
