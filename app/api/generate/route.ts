import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'
import { supabase } from '../../../lib/supabase'
import { currentUser } from '@clerk/nextjs/server'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

export async function POST(request: NextRequest) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { title, prompt, lyrics, bpm, genre, instrumental, coverPrompt } = await request.json()

  try {
    // Call Replicate for music - replace with actual model
    const musicOutput = await replicate.run(
      "meta/musicgen:7a76a8258b23fae65c5a22debb8841d1d7e816b75c2f24218cd2bd85737879072",
      {
        input: {
          prompt,
          lyrics,
          bpm: parseInt(bpm),
          genre,
          instrumental,
        }
      }
    )

    // Call for cover art - replace with actual model
    const coverOutput = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      {
        input: {
          prompt: coverPrompt,
        }
      }
    )

    // Save to Supabase
    const { data, error } = await supabase
      .from('songs')
      .insert({
        user_id: user.id,
        title,
        prompt,
        lyrics,
        bpm: parseInt(bpm),
        genre,
        instrumental,
        audio_url: musicOutput, // Assume URL or adjust based on output
        cover_url: coverOutput,
      })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, song: data[0] })
  } catch (error) {
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}