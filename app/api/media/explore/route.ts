import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleOptions } from '@/lib/cors'

// Route verified working - Jan 20, 2026
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
    const limit = Number(searchParams.get('limit')) || 500 // Increased to show all tracks
    const offset = Number(searchParams.get('offset')) || 0

    // Fetch ONLY properly released tracks with cover art
    // The key filter: real releases always have both audio_url AND image_url
    // Tool outputs (effects, boosts, stems, loops, video-to-audio) never have image_url
    const { data, error } = await supabase
      .from('combined_media')
      .select('*')
      // Must have audio
      .not('audio_url', 'is', null)
      .neq('audio_url', '')
      // Must have cover art — this is the strongest signal of a proper release
      // Tool/generation outputs (effects, boosts, stems, loops, video-to-audio) all set image_url: null
      .not('image_url', 'is', null)
      .neq('image_url', '')
      // Exclude internal tool genres (safety net)
      .not('genre', 'in', '(stem,effects,loop,boosted)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('❌ Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch combined media', details: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ Explore API: Fetched ${data?.length || 0} public tracks (is_public=true)`)
    if (data && data.length > 0) {
      console.log(`📊 First track: "${data[0].title}" by ${data[0].user_id}`)
      console.log(`📊 Last track: "${data[data.length - 1].title}" by ${data[data.length - 1].user_id}`)
      
      // Log unique user count
      const uniqueUsers = new Set(data.map(d => d.user_id))
      console.log(`📊 Total unique users: ${uniqueUsers.size}`)
      
      // Log count per user
      const userCounts = new Map()
      data.forEach(d => {
        userCounts.set(d.user_id, (userCounts.get(d.user_id) || 0) + 1)
      })
      console.log(`📊 Tracks per user:`, Object.fromEntries(userCounts))
    } else {
      console.warn('⚠️ No tracks returned! Check if is_public is set to true in database.')
    }

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

    // Add username to each media item and normalize field names
    const mediaWithUsers = (data || []).map((media) => {
      const username = usernameMap.get(media.user_id) || 'Unknown User'
      
      return {
        ...media,
        audioUrl: media.audio_url, // Normalize for AudioPlayerContext
        imageUrl: media.image_url, // Normalize for AudioPlayerContext
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

