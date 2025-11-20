import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get('limit')) || 500 // Increased to show all tracks
    const offset = Number(searchParams.get('offset')) || 0

    // Fetch PUBLIC combined media only for explore page
    const { data, error } = await supabase
      .from('combined_media')
      .select('id, title, audio_url, image_url, user_id, username, likes, plays, created_at, genre, mood, bpm, lyrics')
      // Filter out tracks with NULL or empty audio_url
      .not('audio_url', 'is', null)
      .neq('audio_url', '')
      // ONLY show public tracks on explore
      .eq('is_public', true)
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
      console.log(`📊 First track: "${data[0].title}" by ${data[0].username || data[0].user_id}`)
      console.log(`   - Audio: ${data[0].audio_url?.substring(0, 50)}...`)
      console.log(`   - Image: ${data[0].image_url?.substring(0, 50) || 'MISSING'}...`)
      console.log(`📊 Last track: "${data[data.length - 1].title}" by ${data[data.length - 1].username || data[data.length - 1].user_id}`)
      
      // Check for missing images
      const missingImages = data.filter(d => !d.image_url || d.image_url === '').length
      if (missingImages > 0) {
        console.warn(`⚠️ ${missingImages}/${data.length} tracks have missing image_url - will use fallback`)
      }
      
      // Log unique user count
      const uniqueUsers = new Set(data.map(d => d.user_id))
      console.log(`📊 Total unique users: ${uniqueUsers.size}`)
    } else {
      console.warn('⚠️ No tracks returned! Check if is_public is set to true in database.')
      console.log('   Possible causes: No released tracks, or is_public column not set correctly')
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

    // Add username to each media item, normalize field names, and provide fallback images
    const mediaWithUsers = (data || []).map((media) => {
      const username = media.username || usernameMap.get(media.user_id) || 'Unknown User'
      const imageUrl = media.image_url || '/placeholder-cover.png' // Fallback for missing images
      
      return {
        ...media,
        audioUrl: media.audio_url,
        imageUrl: imageUrl,
        image_url: imageUrl, // Keep both for compatibility
        username: username,
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

