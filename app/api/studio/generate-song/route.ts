/**
 * Song Generation API - MiniMax Music 1.5
 * Professional song generation with vocals using MiniMax
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

    const { prompt, title, genre = 'pop', output_format = 'mp3', lyrics } = await request.json();

    if (!prompt) {
      return corsResponse(
        NextResponse.json({ error: 'Prompt required' }, { status: 400 })
      );
    }

    // Initialize Replicate
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN!,
    });

    // Initialize Supabase (service role) for credits
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check and deduct credits (2 credits)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits, total_generated')
      .eq('clerk_user_id', userId)
      .single();

    if (userError) {
      console.error('Credits fetch error:', userError);
      return corsResponse(NextResponse.json({ success: false, error: 'Failed to fetch user credits' }, { status: 500 }));
    }

    const currentCredits = userData?.credits ?? 0;
    if (currentCredits < 2) {
      return corsResponse(NextResponse.json({ success: false, error: 'Insufficient credits (need 2)' }, { status: 402 }));
    }

    const deductResp = await supabase
      .from('users')
      .update({ credits: currentCredits - 2, updated_at: new Date().toISOString() })
      .eq('clerk_user_id', userId);

    if (deductResp.error) {
      console.error('Credit deduction error:', deductResp.error);
      return corsResponse(NextResponse.json({ success: false, error: 'Failed to deduct credits' }, { status: 500 }));
    }

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

    // Create song generation prediction (MiniMax requires lyrics)
    const prediction = await replicate.predictions.create({
      model: "minimax/music-1.5",
      input: {
        lyrics: finalLyrics,
        title: finalTitle,
        genre: finalGenre,
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
        .update({ credits: (currentCredits), updated_at: new Date().toISOString() })
        .eq('clerk_user_id', userId);
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
        .update({ credits: (currentCredits), updated_at: new Date().toISOString() })
        .eq('clerk_user_id', userId);
      return corsResponse(
        NextResponse.json({ success: false, error: 'No audio URL returned from model', raw: out }, { status: 502 })
      );
    }

    console.log('✅ Song generated successfully:', audioUrl);

    // On success, increment total_generated
    const newTotalGenerated = (userData?.total_generated ?? 0) + 1;
    await supabase
      .from('users')
      .update({ total_generated: newTotalGenerated, updated_at: new Date().toISOString() })
      .eq('clerk_user_id', userId);

    return corsResponse(
      NextResponse.json({
        success: true,
        audioUrl,
        metadata: {
          prompt,
          title: finalTitle,
          genre: finalGenre,
          outputFormat: output_format,
          lyrics: finalLyrics,
          model: 'minimax-music-1.5',
          predictionId: result.id,
        }
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
