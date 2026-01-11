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

    // If user not found, create minimal user record
    if (userError || !userData) {
      await supabase
        .from('users')
        .insert({
          clerk_user_id: userId,
          email: '',
          username: null,
          credits: 0
        })
        .select()
        .single()
      
      // Return early with empty profile
      return corsResponse(NextResponse.json({ 
        success: true, 
        profile: {
          username: 'User',
          email: '',
          bio: null,
          tagline: null,
          avatar: null,
          banner_url: null,
          banner_type: null,
          totalLikes: 0,
          totalPlays: 0,
          songCount: 0,
          followerCount: 0,
          followingCount: 0,
          combinedMedia: []
        }
      }))
    }

    // Fetch user's combined media - SHOW ALL TRACKS (no is_public filter)
    const { data: combinedMedia, error: mediaError } = await supabase
      .from('combined_media')
      .select(`
        id,
        title,
        audio_url,
        image_url,
        video_url,
        audio_prompt,
        image_prompt,
        user_id,
        likes,
        plays,
        views,
        is_public,
        created_at,
        media_type,
        content_type
      `)
      .eq('user_id', userId)
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

    // Sanitize banner URL to remove invalid characters
    const sanitizedBannerUrl = userData.banner_url 
      ? userData.banner_url.replace(/[\r\n\t]/g, '') 
      : null

    const profileData = {
      username: userData.username,
      email: '', // Not exposed for privacy
      bio: userData.bio,
      tagline: userData.tagline,
      avatar: userData.avatar_url,
      banner_url: sanitizedBannerUrl,
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