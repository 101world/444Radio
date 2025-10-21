import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'

/**
 * POST /api/user/update-username
 * Updates the username in Supabase to match Clerk's username
 */
export async function POST() {
  try {
    const { userId } = await auth()
    const user = await currentUser()

    if (!userId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Get the username from Clerk (in priority order)
    const clerkUsername = user.username || user.firstName || user.emailAddresses[0]?.emailAddress?.split('@')[0] || `user_${userId.slice(-8)}`

    console.log('Updating username for user:', userId)
    console.log('Clerk username:', clerkUsername)

    // Update username in Supabase
    const response = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          username: clerkUsername,
          updated_at: new Date().toISOString()
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error('Supabase update error:', error)
      return NextResponse.json({ error: 'Failed to update username' }, { status: 500 })
    }

    const data = await response.json()
    console.log('Username updated successfully:', data)

    return NextResponse.json({ 
      success: true, 
      message: 'Username updated successfully',
      username: clerkUsername,
      data 
    })

  } catch (error) {
    console.error('Update username error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
