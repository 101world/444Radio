/**
 * Generate Effect API - Creates audio effects for effects chain
 * Uses Replicate stable-audio model (0.5 credits per generation)
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Replicate from 'replicate';
import { corsResponse, handleOptions } from '@/lib/cors';
import { supabase } from '@/lib/supabase';

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

    const { prompt, trackId, trackName } = await request.json();

    if (!prompt) {
      return corsResponse(
        NextResponse.json({ error: 'Effect prompt required' }, { status: 400 })
      );
    }

    // Check user credits (0.5 per generation)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits, total_generated')
      .eq('clerk_user_id', userId)
      .single();

    if (userError || !userData) {
      return corsResponse(
        NextResponse.json({ error: 'User not found' }, { status: 404 })
      );
    }

    if (userData.credits < 0.5) {
      return corsResponse(
        NextResponse.json({ error: 'Insufficient credits (0.5 required)' }, { status: 403 })
      );
    }

    // Initialize Replicate
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN!,
    });

    // Create stable-audio prediction for effect
    const prediction = await replicate.predictions.create({
      version: "a5ac1caa88116a0c3fb4b4ecceaba2b1e3f10fcd0d3ca8f3a81d6db83d9d8a55",
      input: {
        prompt: prompt,
        seconds_total: 30, // 30 second effect
        steps: 100,
      }
    });

    // Wait for completion (90 second timeout)
    let result = prediction;
    const startTime = Date.now();
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      if (Date.now() - startTime > 90000) {
        throw new Error('Effect generation timed out');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      result = await replicate.predictions.get(result.id);
    }

    if (result.status === 'failed') {
      throw new Error('Effect generation failed');
    }

    const output = result.output as string;
    if (!output) {
      throw new Error('No output from stable-audio model');
    }

    // Deduct credits
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        credits: userData.credits - 0.5,
        total_generated: (userData.total_generated || 0) + 1
      })
      .eq('clerk_user_id', userId);

    if (updateError) {
      console.error('Failed to deduct credits:', updateError);
    }

    return corsResponse(
      NextResponse.json({
        success: true,
        audioUrl: output,
        effectName: prompt.substring(0, 50), // Truncate long prompts
        message: 'Effect generated successfully',
        creditsRemaining: userData.credits - 0.5,
      })
    );

  } catch (error) {
    console.error('Effect generation error:', error);
    return corsResponse(
      NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Effect generation failed',
          success: false 
        },
        { status: 500 }
      )
    );
  }
}
