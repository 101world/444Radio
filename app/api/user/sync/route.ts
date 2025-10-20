import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'

/**
 * POST /api/user/sync
 * Ensures the current user exists in the Supabase users table
 * This is called from the client when a user first loads the app
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    const user = await currentUser()

    if (!userId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Upsert user to Supabase (insert or update if exists)
    const response = await fetch(
      `${supabaseUrl}/rest/v1/users`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          clerk_user_id: userId,
          username: user.username || user.firstName || user.emailAddresses[0]?.emailAddress?.split('@')[0] || `user_${userId.slice(-8)}`,
          email: user.emailAddresses[0]?.emailAddress || '',
          first_name: user.firstName || '',
          last_name: user.lastName || '',
          avatar_url: user.imageUrl || '',
          updated_at: new Date().toISOString()
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error('Supabase sync error:', error)
      return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 })
    }

    const data = await response.json()
    console.log('User synced:', data)

    return NextResponse.json({ 
      success: true, 
      user: Array.isArray(data) ? data[0] : data 
    })
  } catch (error) {
    console.error('Error syncing user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
