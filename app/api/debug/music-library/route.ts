import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if music_library table exists and has data
    const checkTable = await fetch(
      `${supabaseUrl}/rest/v1/music_library?select=*&limit=5`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const allMusic = await checkTable.json()

    // Check user's music
    const userMusic = await fetch(
      `${supabaseUrl}/rest/v1/music_library?clerk_user_id=eq.${userId}`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const userMusicData = await userMusic.json()

    // Get table schema
    const schemaCheck = await fetch(
      `${supabaseUrl}/rest/v1/music_library?select=*&limit=0`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'count=exact'
        }
      }
    )

    const totalCount = schemaCheck.headers.get('Content-Range')?.split('/')[1] || '0'

    return NextResponse.json({
      userId,
      table_exists: !allMusic.error,
      total_records: parseInt(totalCount),
      user_records: Array.isArray(userMusicData) ? userMusicData.length : 0,
      sample_data: Array.isArray(allMusic) ? allMusic.slice(0, 2) : null,
      user_data: Array.isArray(userMusicData) ? userMusicData.slice(0, 2) : null,
      error: allMusic.error || userMusicData.error || null
    })

  } catch (error) {
    console.error('Error in debug:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
