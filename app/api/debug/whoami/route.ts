import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'

/**
 * GET /api/debug/whoami
 * Shows current user's Clerk ID and username
 */
export async function GET() {
  try {
    const { userId } = await auth()
    const user = await currentUser()

    if (!userId || !user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      clerkUserId: userId,
      username: user.username,
      email: user.emailAddresses[0]?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      expectedUserId: 'user_34J8MP3KCfczODGn9yKMolWPX9R',
      isCorrectUser: userId === 'user_34J8MP3KCfczODGn9yKMolWPX9R'
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to get user info', details: error.message },
      { status: 500 }
    )
  }
}
