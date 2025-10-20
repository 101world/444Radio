import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    // Fetch user's combined media (both public and private if it's their profile)
    const { data, error } = await supabase
      .from('combined_media')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch user media', details: error.message },
        { status: 500 }
      )
    }

    // Fetch username
    const { data: userData } = await supabase
      .from('users')
      .select('username')
      .eq('clerk_user_id', userId)
      .single()

    return NextResponse.json({
      success: true,
      combinedMedia: data || [],
      username: userData?.username || 'Unknown User',
      trackCount: data?.length || 0,
      totalPlays: data?.reduce((sum, media) => sum + (media.plays || 0), 0) || 0
    })
  } catch (error) {
    console.error('Error fetching user media:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
