import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?audio_url=not.is.null&image_url=not.is.null&is_published=eq.false&order=created_at.desc&limit=100`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    )

    const data = await resp.json()

    return NextResponse.json({ success: true, count: Array.isArray(data) ? data.length : 0, items: data })
  } catch (err) {
    console.error('Debug legacy releases error:', err)
    return NextResponse.json({ error: 'Failed to fetch debug data' }, { status: 500 })
  }
}
