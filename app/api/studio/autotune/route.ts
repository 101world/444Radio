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

    const { audioUrl, trackId, trackName, correctionStrength = 0.5, pitchShift = 0 } = await request.json();

    if (!audioUrl) {
      return corsResponse(
        NextResponse.json({ error: 'Audio URL required' }, { status: 400 })
      );
    }

    // Initialize Replicate
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN!,
    });

    console.log('🎵 Applying auto-tune:', { correctionStrength, pitchShift });

    // Create autotune prediction (use version hash)
    const prediction = await replicate.predictions.create({
      version: "0dee5fee28e8ec4e7e9e04bd1ee70d9ffc49c58ee78f7f26f3ca99d2e3ddd6b7",
      input: {
        audio: audioUrl,
        correction_strength: correctionStrength,
        pitch_shift: pitchShift,
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
