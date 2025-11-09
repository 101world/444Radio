import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }

    const { mediaId, title } = await req.json()

    if (!mediaId || !title || title.trim().length < 1) {
      return corsResponse(
        NextResponse.json({ error: 'Invalid title' }, { status: 400 })
      )
    }

    // Verify the media belongs to the user
    const { data: media, error: fetchError } = await supabase
      .from('combined_media')
      .select('user_id')
      .eq('id', mediaId)
      .single()

    if (fetchError || !media) {
      return corsResponse(
        NextResponse.json({ error: 'Media not found' }, { status: 404 })
      )
    }

    if (media.user_id !== userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      )
    }

    // Update the title
    const { error: updateError } = await supabase
      .from('combined_media')
      .update({ title: title.trim() })
      .eq('id', mediaId)

    if (updateError) {
      console.error('Failed to update title:', updateError)
      return corsResponse(
        NextResponse.json({ error: 'Failed to update title' }, { status: 500 })
      )
    }

    return corsResponse(
      NextResponse.json({ success: true, title: title.trim() })
    )
  } catch (error) {
    console.error('Error updating title:', error)
    return corsResponse(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    )
  }
}
