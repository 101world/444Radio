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
    
    // First, try to fetch the user with core fields only (always exist)
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
    
    // Try to get subscription status separately (may not exist yet)
    let subscriptionStatus = 'none'
    if (user) {
      try {
        const subResponse = await fetch(
          `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=subscription_status`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            }
          }
        )
        if (subResponse.ok) {
          const subData = await subResponse.json()
          subscriptionStatus = subData?.[0]?.subscription_status || 'none'
        }
      } catch (e) {
        // Column doesn't exist yet, that's okay
        console.log('Subscription column not found, using default')
      }
    }

    // If user doesn't exist, upsert them (avoids unique constraint race with webhook)
    if (!user) {
      console.log(`Creating or fetching user ${userId} in Supabase (webhook race condition)`)      
      const createResponse = await fetch(
        `${supabaseUrl}/rest/v1/users?on_conflict=clerk_user_id`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation,resolution=merge-duplicates'
          },
          body: JSON.stringify({
            clerk_user_id: userId,
            email: '', // Will be updated by webhook
            credits: 20, // Give 20 credits automatically on signup
            total_generated: 0
          })
        }
      )

      if (createResponse.ok) {
        const newUserData = await createResponse.json()
        user = newUserData?.[0]
        console.log('User created via upsert')
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
      credits: user?.credits || 0, // Default to 0 if still not found
      totalGenerated: user?.total_generated || 0,
      subscription_status: subscriptionStatus
    }))
  } catch (error) {
    console.error('Error fetching credits:', error)
    return corsResponse(NextResponse.json({ 
      error: 'Failed to fetch credits',
      credits: 0, // Return 0 as fallback - users must decrypt
      totalGenerated: 0
    }, { status: 500 }))
  }
}

export async function POST() {
  const { userId } = await auth()

  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const response = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,total_generated`,
      {
        method: 'GET',
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
    const user = data?.[0]
    
    // Try to get subscription status
    let subscriptionStatus = 'none'
    try {
      const subResponse = await fetch(
        `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=subscription_status`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      )
      if (subResponse.ok) {
        const subData = await subResponse.json()
        subscriptionStatus = subData?.[0]?.subscription_status || 'none'
      }
    } catch (e) {
      console.log('Subscription column not found in POST')
    }

    return corsResponse(NextResponse.json({ 
      credits: user?.credits || 0,
      totalGenerated: user?.total_generated || 0,
      subscription_status: subscriptionStatus
    }))
  } catch (error) {
    console.error('Error fetching credits (POST):', error)
    return corsResponse(NextResponse.json({ 
      error: 'Failed to fetch credits',
      credits: 0,
      totalGenerated: 0
    }, { status: 500 }))
  }
}

