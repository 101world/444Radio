import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { targetUserId, action } = await request.json()

    if (!targetUserId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (action === 'follow') {
      // Insert follow relationship
      const { error } = await supabaseAdmin
        .from('followers')
        .insert({
          follower_id: clerkUserId,
          following_id: targetUserId
        })

      if (error) throw error

      // Create notification for the followed user
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: targetUserId,
          type: 'follow',
          data: { by: clerkUserId }
        })
        .then(({ error }) => {
          if (error) console.error('[Follow] Notification insert failed:', error)
        })

      return NextResponse.json({ success: true, isFollowing: true })
    } else if (action === 'unfollow') {
      // Delete follow relationship
      const { error } = await supabaseAdmin
        .from('followers')
        .delete()
        .eq('follower_id', clerkUserId)
        .eq('following_id', targetUserId)

      if (error) throw error

      return NextResponse.json({ success: true, isFollowing: false })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Follow API error:', error)
    return NextResponse.json({ error: 'Failed to update follow status' }, { status: 500 })
  }
}
