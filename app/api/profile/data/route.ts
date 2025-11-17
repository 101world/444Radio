import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return corsResponse(NextResponse.json({ success: false, error: 'userId required' }, { status: 400 }))
    }

    // Fetch user profile data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('username, bio, tagline, avatar_url, banner_url, banner_type, created_at')
      .eq('clerk_user_id', userId)
      .single()

    if (userError || !userData) {
      return corsResponse(NextResponse.json({ success: false, error: 'User not found' }, { status: 404 }))
    }

    // Fetch user's combined media
    const { data: combinedMedia, error: mediaError } = await supabase
      .from('combined_media')
      .select(`
        id,
        title,
        audio_url,
        image_url,
        user_id,
        likes,
        plays,
        is_public,
        created_at
      `)
      .eq('user_id', userId)
      .eq('is_public', true)
      .order('created_at', { ascending: false })

    if (mediaError) {
      console.error('Error fetching media:', mediaError)
    }

    // Fetch follower/following counts
    const { count: followerCount } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId)

    const { count: followingCount } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId)

    // Calculate total likes and plays
    const totalLikes = (combinedMedia || []).reduce((sum, media) => sum + (media.likes || 0), 0)
    const totalPlays = (combinedMedia || []).reduce((sum, media) => sum + (media.plays || 0), 0)

    const profileData = {
      username: userData.username,
      email: '', // Not exposed for privacy
      bio: userData.bio,
      tagline: userData.tagline,
      avatar: userData.avatar_url,
      banner_url: userData.banner_url,
      banner_type: userData.banner_type,
      totalLikes,
      totalPlays,
      songCount: (combinedMedia || []).length,
      followerCount: followerCount || 0,
      followingCount: followingCount || 0,
      combinedMedia: combinedMedia || []
    }

    return corsResponse(NextResponse.json({ success: true, profile: profileData }))
  } catch (error) {
    console.error('Profile data fetch error:', error)
    return corsResponse(NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 }))
  }
}