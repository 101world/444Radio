import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const songId = searchParams.get('songId')
    const imageId = searchParams.get('imageId')

    if (!songId && !imageId) {
      return NextResponse.json({ error: 'No item ID provided' }, { status: 400 })
    }

    // Delete song
    if (songId) {
      const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', songId)
        .eq('user_id', userId) // Ensure user owns the song

      if (error) {
        console.error('Error deleting song:', error)
        return NextResponse.json({ error: 'Failed to delete song' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Song deleted successfully' })
    }

    // Delete image (cover art)
    if (imageId) {
      const { error } = await supabase
        .from('images')
        .delete()
        .eq('id', imageId)
        .eq('user_id', userId) // Ensure user owns the image

      if (error) {
        console.error('Error deleting image:', error)
        return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Image deleted successfully' })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
