import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const { userId } = await auth()
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Check what's in music_library for this user
    const mlResponse = await fetch(
      `${supabaseUrl}/rest/v1/music_library?clerk_user_id=eq.${userId}`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )
    const mlData = await mlResponse.json()

    // Check what's in combined_media for this user
    const cmResponse = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?user_id=eq.${userId}&audio_url=not.is.null`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )
    const cmData = await cmResponse.json()

    return NextResponse.json({
      currentUserId: userId,
      musicLibraryCount: Array.isArray(mlData) ? mlData.length : 0,
      combinedMediaCount: Array.isArray(cmData) ? cmData.length : 0,
      musicLibrarySample: Array.isArray(mlData) ? mlData.slice(0, 3) : [],
      combinedMediaSample: Array.isArray(cmData) ? cmData.slice(0, 3) : []
    })

  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
