/**
 * Song Generation API - MiniMax Music 1.5
 * Professional song generation with vocals using MiniMax
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

    const { prompt, genre = 'pop', mood = 'upbeat', has_vocals = true, duration = 30 } = await request.json();

    if (!prompt) {
      return corsResponse(
        NextResponse.json({ error: 'Prompt required' }, { status: 400 })
      );
    }

    // Initialize Replicate
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN!,
    });

    console.log('🎤 Generating song with MiniMax Music 1.5:', { prompt, genre, mood, has_vocals, duration });

    // Build enhanced prompt
    const enhancedPrompt = `${genre} ${mood} song, ${prompt}${has_vocals ? ', with vocals' : ', instrumental'}`;

    // Create song generation prediction
    const prediction = await replicate.predictions.create({
      model: "minimax/music-1.5",
      input: {
        prompt: enhancedPrompt,
        duration: Math.min(duration, 120), // Max 120 seconds
        model_type: has_vocals ? "vocals" : "instrumental",
      }
    });

    // Wait for completion (180 second timeout for longer songs)
    let result = prediction;
    const startTime = Date.now();
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      if (Date.now() - startTime > 180000) {
        return corsResponse(
          NextResponse.json({ 
            success: false, 
            error: 'Generation timeout - try a shorter duration' 
          }, { status: 408 })
        );
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      result = await replicate.predictions.get(result.id);
      console.log('🔄 Song generation status:', result.status);
    }

    if (result.status === 'failed') {
      return corsResponse(
        NextResponse.json({ 
          success: false, 
          error: result.error || 'Song generation failed' 
        }, { status: 500 })
      );
    }

    // Extract audio URL from output
    const audioUrl = result.output;

    console.log('✅ Song generated successfully:', audioUrl);

    return corsResponse(
      NextResponse.json({
        success: true,
        audioUrl,
        metadata: {
          prompt: enhancedPrompt,
          genre,
          mood,
          hasVocals: has_vocals,
          duration,
          model: 'minimax-music-1.5',
          predictionId: result.id,
        }
      })
    );

  } catch (error) {
    console.error('❌ Song generation error:', error);
    return corsResponse(
      NextResponse.json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Song generation failed' 
      }, { status: 500 })
    );
  }
}
