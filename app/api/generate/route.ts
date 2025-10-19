import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import { currentUser } from '@clerk/nextjs/server'

export async function POST(request: NextRequest) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { prompt, genre, bpm, instrumental, coverPrompt, outputType = 'image' } = await request.json()

  try {
    // Check if user has enough credits
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_user_id', user.id)
      .single()

    if (userError) throw userError

    if (!userData || userData.credits < 1) {
      return NextResponse.json({ 
        error: 'Insufficient credits',
        message: 'You need at least 1 credit to generate music' 
      }, { status: 402 })
    }

    // Create initial song record with "generating" status
    // Credits will be deducted automatically by the database trigger
    // Songs are PRIVATE by default - user can make public from profile
    const { data, error } = await supabase
      .from('songs')
      .insert({
        user_id: user.id,
        title: prompt.substring(0, 50) + '...', // Temporary title
        prompt,
        genre: genre || null,
        bpm: bpm ? parseInt(bpm) : null,
        instrumental: instrumental || false,
        cover_prompt: coverPrompt || prompt,
        status: 'generating', // Will trigger modal to start generation
        is_public: false, // 🔒 PRIVATE by default!
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return the song ID so frontend can track generation progress
    return NextResponse.json({ 
      success: true, 
      songId: data.id,
      outputType,
      prompt
    })
  } catch (error) {
    console.error('Generation initiation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to initiate generation'
    return NextResponse.json({ 
      error: errorMessage
    }, { status: 500 })
  }
}