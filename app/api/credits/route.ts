import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '../../../lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    // First, try to fetch the user
    const response = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,total_generated`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch user data')
    }

    const data = await response.json()
    let user = data?.[0]

    // If user doesn't exist, create them with 20 credits (race condition with webhook)
    if (!user) {
      console.log(`Creating user ${userId} in Supabase (webhook race condition)`)
      
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
            clerk_user_id: userId,
            email: '', // Will be updated by webhook
            credits: 20,
            total_generated: 0
          })
        }
      )

      if (createResponse.ok) {
        const newUserData = await createResponse.json()
        user = newUserData?.[0]
        console.log('User created successfully')
      } else {
        // User might have been created by webhook in the meantime, try fetching again
        const retryResponse = await fetch(
          `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,total_generated`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            }
          }
        )
        
        if (retryResponse.ok) {
          const retryData = await retryResponse.json()
          user = retryData?.[0]
        }
      }
    }

    return corsResponse(NextResponse.json({ 
      credits: user?.credits || 20, // Default to 20 if still not found
      totalGenerated: user?.total_generated || 0
    }))
  } catch (error) {
    console.error('Error fetching credits:', error)
    return corsResponse(NextResponse.json({ 
      error: 'Failed to fetch credits',
      credits: 20, // Return 20 as fallback instead of 0
      totalGenerated: 0
    }, { status: 500 }))
  }
}

