/**
 * AI Effect API - Audio effects using Replicate stable-audio
 * Generates audio effects based on prompts
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

    // Run stable-audio model for effect generation
    const output = await replicate.run(
      "smaerdlatigid/stable-audio:a5ac1caa88116a0c3fb4b4ecceaba2b1e3f10fcd0d3ca8f3a81d6db83d9d8a55",
      {
        input: {
          prompt: `Audio effect: ${prompt}`,
          seconds_total: 10, // Short effect duration
          steps: 20,
        }
      }
    ) as unknown as string;

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
    console.error('AI effect error:', error);
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
