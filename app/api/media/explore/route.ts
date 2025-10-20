import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get('limit')) || 20
    const offset = Number(searchParams.get('offset')) || 0

    // Fetch public combined media with username
    const { data, error } = await supabase
      .from('combined_media')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch combined media', details: error.message },
        { status: 500 }
      )
    }

    // Username is now directly in combined_media table
    // But if username is missing (old records), fetch from users table
    const mediaWithUsers = await Promise.all(
      (data || []).map(async (media) => {
        let username = media.username
        
        // Fallback: if username is missing, fetch from users table
        if (!username || username === 'anonymous') {
          const { data: userData } = await supabase
            .from('users')
            .select('username')
            .eq('clerk_user_id', media.user_id)
            .single()
          
          username = userData?.username || 'Unknown User'
        }
        
        return {
          ...media,
          users: { username }
        }
      })
    )

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

