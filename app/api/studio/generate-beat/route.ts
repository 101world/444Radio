/**
 * Beat Generation API - Stable Audio 2.5
 * Uses Stability AI's Stable Audio for professional beat generation
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Replicate from 'replicate';
import { corsResponse, handleOptions } from '@/lib/cors';
import { createClient } from '@supabase/supabase-js';
import { uploadToR2 } from '@/lib/r2-upload';
import { refundCredits } from '@/lib/refund-credits';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: Request) {
  let deductedAmount = 0
  let deductedUserId: string | null = null
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

    // Deduct credits atomically (2 credits for beat generation)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: deductResult, error: deductErr } = await supabaseAdmin.rpc('deduct_credits', {
      p_clerk_user_id: userId,
      p_amount: 2,
      p_type: 'generation_music',
      p_description: `Studio beat generation: ${prompt?.slice(0, 50)}`,
      p_metadata: { generation_type: 'generate-beat', prompt: prompt?.slice(0, 100) }
    });

    const row = deductResult?.[0] || deductResult;
    if (deductErr || !row?.success) {
      return corsResponse(
        NextResponse.json({
          error: row?.error_message || 'Insufficient credits (need 2)',
          required: 2,
          available: row?.new_credits ?? 0
        }, { status: 402 })
      );
    }
    deductedAmount = 2
    deductedUserId = userId

    // Initialize Replicate
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_KEY_LATEST2!,
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
        await refundCredits({ userId, amount: 2, type: 'generation_music', reason: 'Beat generation timeout', metadata: { prompt, duration } }).catch(() => {})
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
      await refundCredits({ userId, amount: 2, type: 'generation_music', reason: `Beat generation failed: ${String(result.error).substring(0, 80)}`, metadata: { prompt, error: String(result.error).substring(0, 200) } }).catch(() => {})
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
      await refundCredits({ userId, amount: 2, type: 'generation_music', reason: 'No audio URL from model', metadata: { prompt, raw: JSON.stringify(out).substring(0, 200) } }).catch(() => {})
      return corsResponse(
        NextResponse.json({ 
          success: false, 
          error: 'No audio URL returned from model',
          raw: out
        }, { status: 502 })
      );
    }

    console.log('✅ Beat generated successfully (temp URL):', audioUrl);

    // Download from Replicate and upload to permanent R2 storage
    let permanentAudioUrl = audioUrl;
    try {
      console.log('📥 Downloading audio from Replicate...');
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.status}`);
      }
      
      const audioBlob = await audioResponse.blob();
      const audioBuffer = Buffer.from(await audioBlob.arrayBuffer());
      
      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedPrompt = prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
      const filename = `beat_${sanitizedPrompt}_${timestamp}.mp3`;
      
      console.log('☁️ Uploading to R2:', filename);
      const uploadResult = await uploadToR2(audioBuffer, 'audio-files', filename);
      
      if (uploadResult.success && uploadResult.url) {
        permanentAudioUrl = uploadResult.url;
        console.log('✅ Audio uploaded to R2:', permanentAudioUrl);
      } else {
        console.error('⚠️ R2 upload failed, using temp URL:', uploadResult.error);
        // Continue with temp URL rather than failing
      }
    } catch (uploadError) {
      console.error('⚠️ Failed to upload to R2:', uploadError);
      // Continue with temp URL rather than failing
    }

    // Save to database (combined_media table) with permanent URL
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { error: dbError } = await supabase
        .from('combined_media')
        .insert([{
          user_id: userId,
          title: `Beat - ${prompt.substring(0, 50)}`,
          content_type: 'audio',
          audio_url: permanentAudioUrl, // Use permanent R2 URL
          is_public: false, // Not released yet - user must go through release flow
          created_at: new Date().toISOString(),
        }]);

      if (dbError) {
        console.error('⚠️ Failed to save beat to database:', dbError);
        // Don't fail the request, just log the error
      } else {
        console.log('💾 Beat saved to library with permanent URL');
      }
    } catch (dbErr) {
      console.error('⚠️ Database save error:', dbErr);
    }

    return corsResponse(
      NextResponse.json({
        success: true,
        audioUrl: permanentAudioUrl, // Return permanent R2 URL
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
    console.error('❌ Beat generation error:', error);    // Refund if credits were already deducted
    if (deductedAmount > 0 && deductedUserId) {
      await refundCredits({ userId: deductedUserId, amount: deductedAmount, type: 'generation_music', reason: `Beat generation error: ${error instanceof Error ? error.message.substring(0, 80) : 'unknown'}`, metadata: { error: String(error).substring(0, 200) } }).catch(() => {})
    }    return corsResponse(
      NextResponse.json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Beat generation failed' 
      }, { status: 500 })
    );
  }
}
