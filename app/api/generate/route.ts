import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '../../../lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(request: NextRequest) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { prompt, genre, bpm, instrumental, coverPrompt, outputType = 'image' } = await request.json()

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Check if user has enough credits
    const userResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${user.id}&select=credits`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user data')
    }

    const userData = await userResponse.json()
    const userRecord = userData?.[0]

    if (!userRecord || userRecord.credits < 1) {
      return NextResponse.json({ 
        error: 'Insufficient credits',
        message: 'You need at least 1 credit to generate music' 
      }, { status: 402 })
    }

    // Create initial song record with "generating" status
    // Credits will be deducted automatically by the database trigger
    // Songs are PRIVATE by default - user can make public from profile
    const songResponse = await fetch(
      `${supabaseUrl}/rest/v1/songs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
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
      }
    )

    if (!songResponse.ok) {
      const errorData = await songResponse.json()
      throw new Error(errorData.message || 'Failed to create song record')
    }

    const songData = await songResponse.json()
    const song = songData?.[0]

    if (!song) {
      throw new Error('No song data returned')
    }

    // Return the song ID so frontend can track generation progress
    return corsResponse(NextResponse.json({ 
      success: true, 
      songId: song.id,
      outputType,
      prompt
    }))
  } catch (error) {
    console.error('Generation initiation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to initiate generation'
    return corsResponse(NextResponse.json({ 
      error: errorMessage
    }, { status: 500 }))
  }
}