/**
 * Generate Effect API - Creates audio effects
 * Uses smaerdlatigid/stable-audio for effect generation
 * Cost: Variable based on duration (0-25 seconds)
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

    const { prompt, secondsTotal = 10 } = await request.json();

    if (!prompt) {
      return corsResponse(
        NextResponse.json({ error: 'Prompt required' }, { status: 400 })
      );
    }

    // Validate duration (0-25 seconds)
    const duration = Math.max(0, Math.min(25, secondsTotal));

    // Calculate credits (0.5 credits per 5 seconds, rounded up)
    const creditsNeeded = Math.ceil(duration / 5) * 0.5;

    // Initialize Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check user credits
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

    if ((userData.credits || 0) < creditsNeeded) {
      return corsResponse(
        NextResponse.json({ error: `Insufficient credits (need ${creditsNeeded})` }, { status: 402 })
      );
    }

    // Deduct credits
    const { error: deductError } = await supabase
      .from('users')
      .update({ credits: (userData.credits || 0) - creditsNeeded, updated_at: new Date().toISOString() })
      .eq('clerk_user_id', userId);

    if (deductError) {
      return corsResponse(
        NextResponse.json({ error: 'Credit deduction failed' }, { status: 500 })
      );
    }

    // Initialize Replicate
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN!,
    });

    console.log('🎨 Generating effect:', { prompt, duration });

    // Create effect generation prediction
    const prediction = await replicate.predictions.create({
      model: "smaerdlatigid/stable-audio",
      input: {
        prompt,
        seconds_total: duration,
      }
    });

    // Wait for completion (90 second timeout)
    let result = prediction;
    const startTime = Date.now();
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      if (Date.now() - startTime > 90000) {
        // Refund credits on timeout
        await supabase
          .from('users')
          .update({ credits: (userData.credits || 0) })
          .eq('clerk_user_id', userId);
        
        return corsResponse(
          NextResponse.json({ success: false, error: 'Effect generation timeout' }, { status: 408 })
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
        NextResponse.json({ success: false, error: result.error || 'Effect generation failed' }, { status: 500 })
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

    console.log('✅ Effect generated:', outputUrl);

    return corsResponse(
      NextResponse.json({
        success: true,
        audioUrl: outputUrl,
        remainingCredits: (userData.credits || 0) - creditsNeeded,
        metadata: {
          prompt,
          duration,
          creditsUsed: creditsNeeded,
          predictionId: result.id,
        }
      })
    );

  } catch (error) {
    console.error('❌ Effect generation error:', error);
    return corsResponse(
      NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Effect generation failed' }, { status: 500 })
    );
  }
}
