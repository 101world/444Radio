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

    // Check and deduct 0.5 credits
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single();

    if (userError || !userData) {
      return corsResponse(
        NextResponse.json({ error: 'User not found' }, { status: 404 })
      );
    }

    if ((userData.credits || 0) < 0.5) {
      return corsResponse(
        NextResponse.json({ error: 'Insufficient credits (need 0.5)' }, { status: 402 })
      );
    }

    // Deduct credits
    const { error: deductError } = await supabase
      .from('users')
      .update({ credits: (userData.credits || 0) - 0.5, updated_at: new Date().toISOString() })
      .eq('clerk_user_id', userId);

    if (deductError) {
      return corsResponse(
        NextResponse.json({ error: 'Credit deduction failed' }, { status: 500 })
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
          .update({ credits: (userData.credits || 0) })
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
        .update({ credits: (userData.credits || 0) })
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
        .update({ credits: (userData.credits || 0) })
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
        remainingCredits: (userData.credits || 0) - 0.5,
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
