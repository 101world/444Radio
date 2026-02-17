/**
 * Song Generation API - MiniMax Music 1.5
 * Professional song generation with vocals using MiniMax
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

    const { prompt, title, genre = 'pop', output_format = 'mp3', lyrics } = await request.json();

    if (!prompt) {
      return corsResponse(
        NextResponse.json({ error: 'Prompt required' }, { status: 400 })
      );
    }

    // Initialize Replicate
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_KEY_LATEST2!,
    });

    // Initialize Supabase (service role) for credits
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Deduct credits atomically (2 credits)
    const { data: deductResult, error: deductErr } = await supabase.rpc('deduct_credits', {
      p_clerk_user_id: userId,
      p_amount: 2,
      p_type: 'generation_music',
      p_description: 'Studio song generation (MiniMax Music 1.5)',
      p_metadata: { generation_type: 'generate-song', prompt: prompt?.slice(0, 100), genre }
    });

    const deductRow = deductResult?.[0] || deductResult;
    if (deductErr || !deductRow?.success) {
      return corsResponse(NextResponse.json({ success: false, error: deductRow?.error_message || 'Insufficient credits (need 2)' }, { status: 402 }));
    }

    const creditsAfterDeduct = deductRow.new_credits;

    // Log successful deduction
    await logCreditTransaction({
      userId, amount: -2, balanceAfter: creditsAfterDeduct,
      type: 'generation_music',
      description: `Studio Song: ${(title || prompt || '').substring(0, 60)}`,
      metadata: { prompt: prompt?.slice(0, 100), genre, generation_type: 'generate-song' },
    })

    console.log('🎤 Generating song with MiniMax Music 1.5:', { prompt, genre, output_format, hasLyrics: !!lyrics, title });

    // Ensure lyrics exist: if missing, generate with Atom (GPT-5 Nano on Replicate)
    let finalLyrics = (typeof lyrics === 'string' ? lyrics.trim() : '') || '';
    if (!finalLyrics) {
      try {
        const atomPrompt = `Generate lyrics based on my prompt - ${prompt}. Structure with [intro] [verse] [chorus] [hook] [bridge] [hook] [chorus] [outro], under 600 characters.`;
        const atomOutput = await replicate.run("openai/gpt-5-nano", { input: { prompt: atomPrompt } });
        if (Array.isArray(atomOutput)) finalLyrics = atomOutput.join('');
        else if (typeof atomOutput === 'string') finalLyrics = atomOutput;
        if (finalLyrics.length > 600) finalLyrics = finalLyrics.substring(0, 600).trim();
      } catch (e) {
        console.warn('⚠️ Atom lyrics generation failed, falling back to prompt as lyrics');
        finalLyrics = prompt;
      }
    }

    const finalTitle = typeof title === 'string' && title.trim() ? title.trim() : (prompt.length > 60 ? `${prompt.slice(0, 57)}...` : prompt);
    const finalGenre = typeof genre === 'string' && genre.trim() ? genre.trim() : 'pop';

    // Create song generation prediction (MiniMax requires lyrics and prompt)
    const prediction = await replicate.predictions.create({
      model: "minimax/music-1.5",
      input: {
        prompt: `${finalGenre ? finalGenre + ' ' : ''}song: ${prompt}`,
        lyrics: finalLyrics,
        title: finalTitle,
        genre: finalGenre,
        audio_format: 'wav', // WAV output for lossless quality
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
      // Rollback credits on failure
      await supabase
        .from('users')
        .update({ credits: creditsAfterDeduct + 2, updated_at: new Date().toISOString() })
        .eq('clerk_user_id', userId);
      await logCreditTransaction({
        userId,
        amount: 2,
        balanceAfter: creditsAfterDeduct + 2,
        type: 'credit_refund',
        status: 'success',
        description: 'Refund: song generation failed',
        metadata: { generation_type: 'generate-song' },
      });
      return corsResponse(
        NextResponse.json({ 
          success: false, 
          error: result.error || 'Song generation failed' 
        }, { status: 500 })
      );
    }

    // Extract audio URL from output (handle array/string/object variants)
    let audioUrl: string | undefined;
    const out: any = (result as any).output;
    if (Array.isArray(out)) {
      const first = out[0];
      if (typeof first === 'string') audioUrl = first;
      else if (first && typeof first === 'object') audioUrl = first.audio || first.url || first.src;
      if (!audioUrl) {
        const str = out.find((v: any) => typeof v === 'string');
        if (str) audioUrl = str;
      }
    } else if (typeof out === 'string') {
      audioUrl = out;
    } else if (out && typeof out === 'object') {
      audioUrl = out.audio || out.url || out.src;
    }

    if (!audioUrl) {
      // Rollback credits if no usable output
      await supabase
        .from('users')
        .update({ credits: creditsAfterDeduct + 2, updated_at: new Date().toISOString() })
        .eq('clerk_user_id', userId);
      return corsResponse(
        NextResponse.json({ success: false, error: 'No audio URL returned from model', raw: out }, { status: 502 })
      );
    }

    console.log('✅ Song generated successfully (temp URL):', audioUrl);

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
      const sanitizedTitle = (finalTitle || 'song').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `song_${sanitizedTitle}_${timestamp}.wav`;
      
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
      const { error: dbError } = await supabase
        .from('combined_media')
        .insert([{
          user_id: userId,
          title: finalTitle || `Song - ${prompt.substring(0, 50)}`,
          content_type: 'audio',
          audio_url: permanentAudioUrl, // Use permanent R2 URL
          is_public: false, // Not released yet - user must go through release flow
          created_at: new Date().toISOString(),
        }]);

      if (dbError) {
        console.error('⚠️ Failed to save song to database:', dbError);
        // Don't fail the request, just log the error
      } else {
        console.log('💾 Song saved to library with permanent URL');
      }
    } catch (dbErr) {
      console.error('⚠️ Database save error:', dbErr);
    }

    // On success, increment total_generated (already done atomically by deduct_credits RPC)

    return corsResponse(
      NextResponse.json({
        success: true,
        audioUrl: permanentAudioUrl, // Return permanent R2 URL
        metadata: {
          prompt,
          title: finalTitle,
          genre: finalGenre,
          outputFormat: output_format,
          lyrics: finalLyrics,
          model: 'minimax-music-1.5',
          predictionId: result.id,
        },
        remainingCredits: creditsAfterDeduct
      })
    );

  } catch (error) {
    console.error('❌ Song generation error:', error);
    // Best-effort: cannot safely refund here without current credits context; recommend manual check.
    return corsResponse(
      NextResponse.json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Song generation failed' 
      }, { status: 500 })
    );
  }
}
