import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: Fetch posts for a user's profile
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Fetch posts with user info and engagement stats
    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        id,
        user_id,
        content,
        media_type,
        media_url,
        thumbnail_url,
        attached_song_id,
        likes_count,
        comments_count,
        shares_count,
        created_at,
        users:user_id (
          id,
          username,
          avatar_url
        ),
        media:attached_song_id (
          id,
          title,
          audio_url,
          image_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({ posts: posts || [] })
  } catch (error) {
    console.error('Error fetching posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    )
  }
}

// POST: Create a new post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      content,
      mediaType,
      mediaUrl,
      thumbnailUrl,
      attachedSongId
    } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Create post
    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        content,
        media_type: mediaType,
        media_url: mediaUrl,
        thumbnail_url: thumbnailUrl,
        attached_song_id: attachedSongId,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ post }, { status: 201 })
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    )
  }
}

// DELETE: Delete a post
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId')
    const userId = searchParams.get('userId')

    if (!postId || !userId) {
      return NextResponse.json(
        { error: 'Post ID and User ID required' },
        { status: 400 }
      )
    }

    // Verify ownership before deleting
    const { data: post } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single()

    if (post?.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting post:', error)
    return NextResponse.json(
      { error: 'Failed to delete post' },
      { status: 500 }
    )
  }
}
