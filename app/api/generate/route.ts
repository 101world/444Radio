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
    let userRecord = userData?.[0]

    // If user doesn't exist, create them with 0 credits (must decrypt first)
    if (!userRecord) {
      console.log(`Creating user ${user.id} in Supabase during generation (webhook race condition)`)
      
      const createResponse = await fetch(
        `${supabaseUrl}/rest/v1/users`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            clerk_user_id: user.id,
            email: user.emailAddresses?.[0]?.emailAddress || '',
            username: user.username || null,
            credits: 0, // Users must decrypt to get 20 credits
            total_generated: 0
          })
        }
      )

      if (createResponse.ok) {
        const newUserData = await createResponse.json()
        userRecord = newUserData?.[0]
        console.log('User created successfully with 0 credits')
      } else {
        // Try fetching again in case webhook created it
        const retryResponse = await fetch(
          `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${user.id}&select=credits`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            }
          }
        )
        
        if (retryResponse.ok) {
          const retryData = await retryResponse.json()
          userRecord = retryData?.[0]
        }
      }
    }

    if (!userRecord || userRecord.credits < 1) {
      return NextResponse.json({ 
        error: 'Insufficient credits',
        message: 'You need at least 1 credit to generate music' 
      }, { status: 402 })
    }

    // Create initial song record with "generating" status
    // Credits will be deducted here when song is created
    // Songs are PRIVATE by default - user can make public from profile
    
    // Get username from user data
    const username = user.username || `user_${user.id.substring(0, 8)}`
    
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
          username: username, // Add username for navigation
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

    // ✅ DEDUCT 1 CREDIT from user
    const deductResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${user.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          credits: userRecord.credits - 1,
          total_generated: (userRecord.total_generated || 0) + 1
        })
      }
    )

    if (!deductResponse.ok) {
      console.error('Failed to deduct credit, but continuing...')
    }

    console.log(`✅ Credit deducted. User now has ${userRecord.credits - 1} credits`)

    // Return the song ID so frontend can track generation progress
    return corsResponse(NextResponse.json({ 
      success: true, 
      songId: song.id,
      outputType,
      prompt,
      creditsRemaining: userRecord.credits - 1
    }))
  } catch (error) {
    console.error('Generation initiation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to initiate generation'
    return corsResponse(NextResponse.json({ 
      error: errorMessage
    }, { status: 500 }))
  }
}

