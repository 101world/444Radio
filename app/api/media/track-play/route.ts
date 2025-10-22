import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { mediaId } = await req.json()

    if (!mediaId) {
      return NextResponse.json(
        { error: 'Media ID is required' },
        { status: 400 }
      )
    }

    // First get current play count
    const { data: currentMedia } = await supabase
      .from('combined_media')
      .select('plays')
      .eq('id', mediaId)
      .single()

    const currentPlays = currentMedia?.plays || 0

    // Increment play count
    const { data, error } = await supabase
      .from('combined_media')
      .update({ 
        plays: currentPlays + 1
      })
      .eq('id', mediaId)
      .select('plays')
      .single()

    if (error) {
      console.error('Error updating play count:', error)
      return NextResponse.json(
        { error: 'Failed to update play count' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      plays: data?.plays || 0
    })
  } catch (error) {
    console.error('Error tracking play:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
