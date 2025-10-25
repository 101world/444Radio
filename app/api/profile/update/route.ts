import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { uploadToR2 } from '@/lib/r2-upload'

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

    // Check if request is FormData (with file upload) or JSON
    const contentType = req.headers.get('content-type')
    let username: string
    let avatar: string | undefined

    if (contentType?.includes('multipart/form-data')) {
      const formData = await req.formData()
      username = formData.get('username') as string
      const avatarFile = formData.get('avatar') as File | null

      // Upload avatar to R2 if provided
      if (avatarFile) {
        const avatarKey = `avatars/${userId}-${Date.now()}.${avatarFile.name.split('.').pop()}`
        const uploadResult = await uploadToR2(avatarFile, 'images', avatarKey)
        if (uploadResult.success && uploadResult.url) {
          avatar = uploadResult.url
        }
      }
    } else {
      const body = await req.json()
      username = body.username
      avatar = body.avatar
    }

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
  } catch (error: unknown) {
    console.error('Profile update error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, error: message || 'Internal server error' },
      { status: 500 }
    )
  }
}
