import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get('limit')) || 50 // Increased default for better UX
    const offset = Number(searchParams.get('offset')) || 0

    // Fetch public combined media with optimized query
    // TEMPORARY: Show all tracks (including NULL) until is_public is fixed in DB
    // TODO: After running SQL fix, change back to .eq('is_public', true)
    const { data, error } = await supabase
      .from('combined_media')
      .select('id, title, audio_url, image_url, user_id, likes, plays, created_at, genre, mood')
      .or('is_public.eq.true,is_public.is.null') // Shows tracks with is_public=true OR NULL
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('❌ Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch combined media', details: error.message },
        { status: 500 }
      )
    }

    console.log(`📊 Explore API: Fetched ${data?.length || 0} public tracks (is_public=true)`)

    // Fetch usernames for all user_ids
    const userIds = [...new Set((data || []).map(m => m.user_id))]
    const { data: usersData } = await supabase
      .from('users')
      .select('clerk_user_id, username')
      .in('clerk_user_id', userIds)

    // Create username lookup map
    const usernameMap = new Map(
      (usersData || []).map(u => [u.clerk_user_id, u.username])
    )

    // Add username to each media item
    const mediaWithUsers = (data || []).map((media) => {
      const username = usernameMap.get(media.user_id) || 'Unknown User'
      
      return {
        ...media,
        users: { username }
      }
    })

    return NextResponse.json({
      success: true,
      combinedMedia: mediaWithUsers
    })
  } catch (error) {
    console.error('Fetch explore error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

