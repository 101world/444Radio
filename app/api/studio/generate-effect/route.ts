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

    // Use latest stable-audio version (smaerdlatigid/stable-audio)
    const stableAudioVersion = '80d7a3ff48781aadfe37bd4c0c0317ffa94c67698d661f4792b1b01129a29689';
    const configuredModel = process.env.REPLICATE_EFFECTS_MODEL;
    const configuredVersion = process.env.REPLICATE_EFFECTS_VERSION || stableAudioVersion;

    let prediction: any = null;
    let lastError: any = null;
    let usedModel = '';

    // 1. Try configured version first (most reliable)
    if (configuredVersion && !prediction) {
      try {
        console.log('🎯 Trying configured version:', configuredVersion.slice(0, 12) + '...');
        prediction = await replicate.predictions.create({
          version: configuredVersion,
          input: {
            prompt,
            seconds_total: duration,
          }
        });
        usedModel = 'configured-version';
      } catch (err: any) {
        lastError = err;
        console.warn('❌ Configured version failed:', err.message);
      }
    }

    // 2. Try configured model slug
    if (configuredModel && !prediction) {
      try {
        console.log('🎯 Trying configured model:', configuredModel);
        prediction = await replicate.predictions.create({
          model: configuredModel,
          input: {
            prompt,
            seconds_total: duration,
          }
        });
        usedModel = configuredModel;
      } catch (err: any) {
        lastError = err;
        console.warn('❌ Configured model failed:', err.message);
      }
    }

    // 3. Fallback to meta/musicgen (widely available, reliable)
    if (!prediction) {
      try {
        console.log('🎯 Trying fallback: meta/musicgen');
        prediction = await replicate.predictions.create({
          model: 'meta/musicgen',
          input: {
            prompt,
            duration: Math.min(duration, 30), // musicgen max is 30s
          }
        });
        usedModel = 'meta/musicgen';
      } catch (err: any) {
        lastError = err;
        console.warn('❌ Fallback model failed:', err.message);
      }
    }

    if (!prediction) {
      // Refund on failure to create prediction
      await supabase
        .from('users')
        .update({ credits: (userData.credits || 0) })
        .eq('clerk_user_id', userId);

      const hint = configuredVersion || configuredModel
        ? 'Configured audio model unavailable. Check REPLICATE_EFFECTS_MODEL or REPLICATE_EFFECTS_VERSION.'
        : 'Audio generation unavailable. Please contact support.';
      const msg = lastError instanceof Error ? `${lastError.message}. ${hint}` : hint;
      console.error('❌ All models failed. Last error:', lastError);
      return corsResponse(
        NextResponse.json({ success: false, error: msg }, { status: 502 })
      );
    }

    console.log('✅ Using model:', usedModel);

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
