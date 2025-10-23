import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: Fetch comments for a post
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId')

    if (!postId) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 })
    }

    const { data: comments, error } = await supabase
      .from('post_comments')
      .select(`
        id,
        post_id,
        user_id,
        comment,
        created_at,
        users:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ comments: comments || [] })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

// POST: Add a comment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { postId, userId, comment } = body

    if (!postId || !userId || !comment) {
      return NextResponse.json(
        { error: 'Post ID, User ID, and comment required' },
        { status: 400 }
      )
    }

    // Add comment
    const { data: newComment, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: userId,
        comment
      })
      .select(`
        id,
        post_id,
        user_id,
        comment,
        created_at,
        users:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .single()

    if (error) throw error

    // Increment comments count
    await supabase.rpc('increment_post_comments', { post_id: postId })

    return NextResponse.json({ comment: newComment }, { status: 201 })
  } catch (error) {
    console.error('Error adding comment:', error)
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    )
  }
}

// DELETE: Delete a comment
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('commentId')
    const userId = searchParams.get('userId')

    if (!commentId || !userId) {
      return NextResponse.json(
        { error: 'Comment ID and User ID required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const { data: comment } = await supabase
      .from('post_comments')
      .select('user_id, post_id')
      .eq('id', commentId)
      .single()

    if (comment?.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete comment
    const { error } = await supabase
      .from('post_comments')
      .delete()
      .eq('id', commentId)

    if (error) throw error

    // Decrement comments count
    await supabase.rpc('decrement_post_comments', { post_id: comment.post_id })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    )
  }
}
