/**
 * AI Effect API - Audio effects using Replicate stable-audio (BACKUP COPY)
 * This file is a backup of the original route implementation and is not active.
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

    const { audioUrl, prompt, trackId, trackName } = await request.json();

    if (!audioUrl || !prompt) {
      return corsResponse(
        NextResponse.json({ error: 'Audio URL and prompt required' }, { status: 400 })
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
        message: 'AI effect generated successfully',
        creditsRemaining: userData.credits - 0.5,
      })
    );

  } catch (error) {
    console.error('AI effect error (backup route):', error);
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
