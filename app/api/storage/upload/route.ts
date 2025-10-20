import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { downloadAndUploadToR2 } from '@/lib/storage'

/**
 * POST /api/storage/upload
 * Download a file from Replicate and upload to R2 permanently
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sourceUrl, folder, fileName } = await req.json()

    if (!sourceUrl || !folder || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields: sourceUrl, folder, fileName' },
        { status: 400 }
      )
    }

    if (!['music', 'images'].includes(folder)) {
      return NextResponse.json(
        { error: 'Invalid folder. Must be "music" or "images"' },
        { status: 400 }
      )
    }

    console.log('📦 Uploading to R2:', { userId, folder, fileName })

    // Download from Replicate and upload to R2
    const result = await downloadAndUploadToR2(
      sourceUrl,
      userId,
      folder as 'music' | 'images',
      fileName
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Upload failed' },
        { status: 500 }
      )
    }

    console.log('✅ R2 upload successful:', result.url)

    return NextResponse.json({
      success: true,
      url: result.url,
      key: result.key,
      size: result.size,
    })
  } catch (error) {
    console.error('❌ Storage upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

