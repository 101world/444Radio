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
import { uploadToR2 } from '@/lib/r2-upload';
import { logCreditTransaction } from '@/lib/credit-transactions';

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

    // Log the credit deduction
    await logCreditTransaction({
      userId,
      amount: -creditsNeeded,
      balanceAfter: (userData.credits || 0) - creditsNeeded,
      type: 'generation_effects',
      status: 'success',
      description: `Studio effect generation (${duration}s)`,
      metadata: { generation_type: 'generate-effect', prompt: prompt?.slice(0, 100), duration },
    });

    // Initialize Replicate
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_KEY_LATEST2!,
    });

    console.log('🎨 Generating effect:', { prompt, duration });

    // Use latest stable-audio version (smaerdlatigid/stable-audio)
    const stableAudioVersion = '80d7a3ff48781aadfe37bd4c0c0317ffa94c67698d661f4792b1b01129a29689';
    const configuredModel = process.env.REPLICATE_EFFECTS_MODEL;
    const configuredVersionEnv = process.env.REPLICATE_EFFECTS_VERSION;

    let prediction: any = null;
    let lastError: any = null;
    let usedModel = '';

    // Helper to sanitize error strings to avoid leaking model names/URLs to client logs
    const sanitizeError = (msg: string) =>
      msg
        .replace(/https?:\/\/[^\s]+/g, 'https://api.replicate.com/...')
        .replace(/stability-ai\/stable-audio-open/gi, 'audio-model')
        .replace(/meta\/musicgen/gi, 'audio-model')
        .replace(/smaerdlatigid\/stable-audio/gi, 'audio-model');

    // 1. Always try pinned stable-audio version first (most reliable)
    if (!prediction) {
      try {
        console.log('🎯 Trying pinned version:', stableAudioVersion.slice(0, 12) + '...');
        prediction = await replicate.predictions.create({
          version: stableAudioVersion,
          input: {
            prompt,
            seconds_total: duration,
          }
        });
        usedModel = 'pinned-version';
      } catch (err: any) {
        lastError = err;
        console.warn('❌ Pinned version failed:', err?.message || err);
      }
    }

    // 2. Try env-configured version if provided and different
    if (configuredVersionEnv && configuredVersionEnv !== stableAudioVersion && !prediction) {
      try {
        console.log('🎯 Trying env version:', configuredVersionEnv.slice(0, 12) + '...');
        prediction = await replicate.predictions.create({
          version: configuredVersionEnv,
          input: {
            prompt,
            seconds_total: duration,
          }
        });
        usedModel = 'env-version';
      } catch (err: any) {
        lastError = err;
        console.warn('❌ Env version failed:', err?.message || err);
      }
    }

    // 3. Optionally try configured model slug unless it's a known-bad slug
    if (configuredModel && !/stability-ai\/stable-audio-open/i.test(configuredModel) && !prediction) {
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
        console.warn('❌ Configured model failed:', err?.message || err);
      }
    }

    // 4. Fallback to a common audio model
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
        console.warn('❌ Fallback model failed:', err?.message || err);
      }
    }

    if (!prediction) {
      // Refund on failure to create prediction
      await supabase
        .from('users')
        .update({ credits: (userData.credits || 0) })
        .eq('clerk_user_id', userId);

      const hint = configuredVersionEnv || configuredModel
        ? 'Configured audio model unavailable. Check server audio model settings.'
        : 'Audio generation unavailable. Please contact support.';
      const msg = lastError instanceof Error ? `${sanitizeError(lastError.message)}. ${hint}` : hint;
      console.error('❌ All models failed. Last error:', lastError);
      return corsResponse(
        NextResponse.json({ success: false, error: msg }, { status: 502 })
      );
    }

    console.log('✅ Using model:', usedModel);

    // Wait for completion (extend timeout to 180s for larger generations)
    let result = prediction;
    const startTime = Date.now();
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      if (Date.now() - startTime > 180000) {
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
      // Server-side logging of status for observability
      try { console.log('⏳ Effect status:', result.status); } catch {}
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

    // Extract audio URL robustly across models
    const extractUrl = (out: any): string | undefined => {
      if (!out) return undefined;
      if (typeof out === 'string') return out;
      if (Array.isArray(out)) {
        for (const item of out) {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            if (typeof item.audio === 'string') return item.audio;
            if (typeof item.url === 'string') return item.url;
            // common nested structure { audio: { download_uri: '...' } }
            if (item.audio && typeof item.audio.download_uri === 'string') return item.audio.download_uri;
          }
        }
      }
      if (typeof out === 'object') {
        if (typeof out.audio === 'string') return out.audio;
        if (out.audio && typeof out.audio.download_uri === 'string') return out.audio.download_uri;
        if (typeof out.url === 'string') return out.url;
      }
      return undefined;
    }
    const outputUrl = extractUrl(result.output);

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

    // Download the generated audio and upload to our R2 for stable hosting
    try {
      const fileResp = await fetch(outputUrl);
      if (!fileResp.ok) throw new Error(`Download failed (${fileResp.status})`);
      const contentType = fileResp.headers.get('content-type') || 'audio/mpeg';
      const ext = contentType.includes('wav') ? 'wav' : contentType.includes('ogg') ? 'ogg' : 'mp3';
      const arr = await fileResp.arrayBuffer();
      const filename = `${Date.now()}-effect.${ext}`;
      const key = `users/${userId}/effects/${filename}`;

      // Create a File object compatible with uploadToR2
      const blob = new Blob([arr], { type: contentType });
      // @ts-ignore File is available in Next.js runtime
      const file = new File([blob], filename, { type: contentType });
      const upload = await uploadToR2(file, 'audio-files', key);
      if (upload.success && upload.url) {
        console.log('☁️ Uploaded effect to R2:', upload.url);
        
        // Save effect to library (combined_media table with type='effect')
        try {
          await supabase
            .from('combined_media')
            .insert({
              user_id: userId,
              type: 'effect',
              title: `Effect: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`,
              audio_url: upload.url,
              is_public: false,
              genre: 'effects',
              metadata: {
                prompt,
                duration,
                creditsUsed: creditsNeeded,
                predictionId: result.id,
                source: 'replicate',
              }
            });
          console.log('💾 Effect saved to library');
        } catch (saveErr) {
          console.warn('Failed to save effect to library (non-critical):', saveErr);
        }
        
        return corsResponse(
          NextResponse.json({
            success: true,
            audioUrl: upload.url,
            remainingCredits: (userData.credits || 0) - creditsNeeded,
            metadata: {
              prompt,
              duration,
              creditsUsed: creditsNeeded,
              predictionId: result.id,
              source: 'replicate',
            }
          })
        );
      } else {
        console.warn('R2 upload failed, returning original URL:', upload.error);
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
              source: 'replicate-direct',
            }
          })
        );
      }
    } catch (e) {
      console.warn('Effect download/upload to R2 failed, returning original URL:', e);
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
            source: 'replicate-direct',
          }
        })
      );
    }

  } catch (error) {
    console.error('❌ Effect generation error:', error);
    return corsResponse(
      NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Effect generation failed' }, { status: 500 })
    );
  }
}
