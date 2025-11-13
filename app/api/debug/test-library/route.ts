import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const { userId } = await auth()
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const allUserIds = [
      userId,
      'user_34TAjF6JtnxUyWn8nXx9tq7A3VC',
      'user_35HWELeD4pRQTRxTfGvWP28TnIP',
      'user_34vm60RVmcQgL18b0bpS1sTYhZ',
      'user_34ThsuzQnqd8zqkK5dGPrfREyoU',
      'user_34tKVS04YVAZHi7iHSr3aaZlU60',
      'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB'
    ]

    // Test music_library query
    const mlUrl = `${supabaseUrl}/rest/v1/music_library?or=(clerk_user_id.in.(${allUserIds.join(',')}),user_id.in.(${allUserIds.join(',')}))&order=created_at.desc`
    const mlResponse = await fetch(mlUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      }
    })
    const mlData = await mlResponse.json()

    // Test combined_media query
    const cmUrl = `${supabaseUrl}/rest/v1/combined_media?user_id=in.(${allUserIds.join(',')})&audio_url=not.is.null&order=created_at.desc`
    const cmResponse = await fetch(cmUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      }
    })
    const cmData = await cmResponse.json()

    return NextResponse.json({
      currentUserId: userId,
      allUserIds,
      musicLibrary: {
        url: mlUrl,
        count: Array.isArray(mlData) ? mlData.length : 0,
        data: mlData,
        isArray: Array.isArray(mlData)
      },
      combinedMedia: {
        url: cmUrl,
        count: Array.isArray(cmData) ? cmData.length : 0,
        data: cmData,
        isArray: Array.isArray(cmData)
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message })
  }
}
