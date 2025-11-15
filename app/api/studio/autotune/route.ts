/**
 * Auto-Tune API - Pitch correction using Replicate nateraw/autotune
 * Applies pitch correction to audio and returns processed URL
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Replicate from 'replicate';
import { corsResponse, handleOptions } from '@/lib/cors';

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

    const { audioUrl, trackId, trackName } = await request.json();

    if (!audioUrl) {
      return corsResponse(
        NextResponse.json({ error: 'Audio URL required' }, { status: 400 })
      );
    }

    // Initialize Replicate
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN!,
    });

    // Create autotune prediction (use latest version)
    const prediction = await replicate.predictions.create({
      model: "nateraw/autotune",
      input: {
        audio: audioUrl,
        correction_strength: 0.5, // Moderate pitch correction
      }
    });

    // Wait for completion (60 second timeout)
    let result = prediction;
    const startTime = Date.now();
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      if (Date.now() - startTime > 60000) {
        throw new Error('Auto-tune timed out');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      result = await replicate.predictions.get(result.id);
    }

    if (result.status === 'failed') {
      throw new Error('Auto-tune processing failed');
    }

    const output = result.output as string;
    if (!output) {
      throw new Error('No output from autotune model');
    }

    return corsResponse(
      NextResponse.json({
        success: true,
        audioUrl: output,
        message: 'Auto-tune applied successfully',
      })
    );

  } catch (error) {
    console.error('Auto-tune error:', error);
    return corsResponse(
      NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Auto-tune failed',
          success: false 
        },
        { status: 500 }
      )
    );
  }
}
