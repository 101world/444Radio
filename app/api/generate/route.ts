import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '../../../lib/cors'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { sanitizeCreditError, SAFE_ERROR_MESSAGE } from '@/lib/sanitize-error'

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

    // ✅ DEDUCT 1 CREDIT atomically BEFORE generation (blocks if wallet < $1)
    const deductRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/deduct_credits`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_clerk_user_id: user.id, p_amount: 1 })
      }
    )
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) {
      const raw = await deductRes.json()
      deductResult = Array.isArray(raw) ? raw[0] ?? null : raw
    }
    if (!deductRes.ok || !deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      console.error('❌ Credit deduction blocked:', errorMsg)
      await logCreditTransaction({ userId: user.id, amount: -1, type: 'generation_image', status: 'failed', description: `Image: ${prompt}`, metadata: { prompt, outputType } })
      return corsResponse(NextResponse.json({ error: sanitizeCreditError(errorMsg) }, { status: 402 }))
    }
    console.log(`✅ Credit deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId: user.id, amount: -1, balanceAfter: deductResult.new_credits, type: 'generation_image', description: `Image: ${prompt}`, metadata: { prompt, outputType } })

    // Create initial song record with "generating" status
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

    const creditsAfter = deductResult.new_credits

    // Return the song ID so frontend can track generation progress
    return corsResponse(NextResponse.json({ 
      success: true, 
      songId: song.id,
      outputType,
      prompt,
      creditsRemaining: creditsAfter
    }))
  } catch (error) {
    console.error('Generation initiation error:', error)
    await logCreditTransaction({ userId: user.id, amount: 0, type: 'generation_image', status: 'failed', description: `Image failed: ${prompt || 'unknown'}`, metadata: { prompt, error: String(error).substring(0, 200) } })
    const errorMessage = error instanceof Error ? error.message : 'Failed to initiate generation'
    console.error('Generation initiation - raw error:', errorMessage)
    return corsResponse(NextResponse.json({ 
      error: SAFE_ERROR_MESSAGE
    }, { status: 500 }))
  }
}

