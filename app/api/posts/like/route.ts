import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST: Like/Unlike a post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { postId, userId } = body

    if (!postId || !userId) {
      return NextResponse.json(
        { error: 'Post ID and User ID required' },
        { status: 400 }
      )
    }

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .single()

    if (existingLike) {
      // Unlike: Remove like
      await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId)

      // Decrement likes count
      await supabase.rpc('decrement_post_likes', { post_id: postId })

      return NextResponse.json({ liked: false })
    } else {
      // Like: Add like
      await supabase
        .from('post_likes')
        .insert({ post_id: postId, user_id: userId })

      // Increment likes count
      await supabase.rpc('increment_post_likes', { post_id: postId })

      return NextResponse.json({ liked: true })
    }
  } catch (error) {
    console.error('Error toggling like:', error)
    return NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 }
    )
  }
}
