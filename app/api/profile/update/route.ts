import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { username, avatar } = await req.json()

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      )
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json(
        { success: false, error: 'Invalid username format' },
        { status: 400 }
      )
    }

    // Check if username is already taken by another user
    const { data: existingUser } = await supabase
      .from('users')
      .select('clerk_user_id')
      .eq('username', username)
      .single()

    if (existingUser && existingUser.clerk_user_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Username already taken' },
        { status: 409 }
      )
    }

    // Update Clerk user
    const client = await clerkClient()
    await client.users.updateUser(userId, {
      username: username,
      ...(avatar && { publicMetadata: { avatar } })
    })

    // Update Supabase users table
    const { error: updateError } = await supabase
      .from('users')
      .update({
        username,
        ...(avatar && { avatar })
      })
      .eq('clerk_user_id', userId)

    if (updateError) {
      console.error('Error updating user in database:', updateError)
      // Don't fail the request if Supabase update fails, Clerk update succeeded
    }

    return NextResponse.json({
      success: true,
      username,
      avatar
    })
  } catch (error: any) {
    console.error('Profile update error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
