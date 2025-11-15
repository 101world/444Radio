/**
 * Beat Generation API - Stable Audio 2.5
 * Uses Stability AI's Stable Audio for professional beat generation
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

    const { prompt, duration = 30, bpm = 120 } = await request.json();

    if (!prompt) {
      return corsResponse(
        NextResponse.json({ error: 'Prompt required' }, { status: 400 })
      );
    }

    // Initialize Replicate
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN!,
    });

    console.log('🎵 Generating beat with Stable Audio 2.5:', { prompt, duration, bpm });

    // Create beat generation prediction
    const prediction = await replicate.predictions.create({
      model: "stability-ai/stable-audio-2.5",
      input: {
        prompt: `${prompt}, ${bpm} BPM, instrumental beat, high quality`,
        duration: Math.min(duration, 90), // Max 90 seconds for Stable Audio
        // Stable Audio 2.5 requires steps <= 8
        steps: 8,
        cfg_scale: 7,
      }
    });

    // Wait for completion (120 second timeout for longer audio)
    let result = prediction;
    const startTime = Date.now();
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      if (Date.now() - startTime > 120000) {
        return corsResponse(
          NextResponse.json({ 
            success: false, 
            error: 'Generation timeout - try a shorter duration' 
          }, { status: 408 })
        );
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      result = await replicate.predictions.get(result.id);
      console.log('🔄 Beat generation status:', result.status);
    }

    if (result.status === 'failed') {
      return corsResponse(
        NextResponse.json({ 
          success: false, 
          error: result.error || 'Beat generation failed' 
        }, { status: 500 })
      );
    }

    // Extract audio URL from output (handle array/string/object variants)
    let audioUrl: string | undefined;
    const out: any = (result as any).output;
    if (Array.isArray(out)) {
      // Common: array of URLs or objects
      const first = out[0];
      if (typeof first === 'string') audioUrl = first;
      else if (first && typeof first === 'object') audioUrl = first.audio || first.url || first.src;
      if (!audioUrl) {
        // Try find any string in the array
        const str = out.find((v: any) => typeof v === 'string');
        if (str) audioUrl = str;
      }
    } else if (typeof out === 'string') {
      audioUrl = out;
    } else if (out && typeof out === 'object') {
      audioUrl = out.audio || out.url || out.src;
    }

    if (!audioUrl) {
      return corsResponse(
        NextResponse.json({ 
          success: false, 
          error: 'No audio URL returned from model',
          raw: out
        }, { status: 502 })
      );
    }

    console.log('✅ Beat generated successfully:', audioUrl);

    return corsResponse(
      NextResponse.json({
        success: true,
        audioUrl,
        metadata: {
          prompt,
          duration,
          bpm,
          model: 'stable-audio-2.5',
          predictionId: result.id,
        }
      })
    );

  } catch (error) {
    console.error('❌ Beat generation error:', error);
    return corsResponse(
      NextResponse.json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Beat generation failed' 
      }, { status: 500 })
    );
  }
}
