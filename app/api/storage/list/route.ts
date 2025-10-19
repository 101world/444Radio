import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAllUserMedia, listUserFiles } from '@/lib/storage'

/**
 * GET /api/storage/list?folder=music
 * List all files for authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const folder = searchParams.get('folder') as 'music' | 'images' | 'combined' | null

    if (folder) {
      // List specific folder
      if (!['music', 'images', 'combined'].includes(folder)) {
        return NextResponse.json(
          { error: 'Invalid folder. Must be "music", "images", or "combined"' },
          { status: 400 }
        )
      }

      const files = await listUserFiles(userId, folder)
      return NextResponse.json({
        success: true,
        folder,
        files,
      })
    } else {
      // List all folders
      const media = await getAllUserMedia(userId)
      return NextResponse.json({
        success: true,
        media,
      })
    }
  } catch (error) {
    console.error('❌ Storage list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
