import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { uploadToR2 } from '@/lib/r2-upload'

// Increase body size limit for file uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
}

// Allow longer execution time for large uploads
export const maxDuration = 60

/**
 * POST /api/upload/media
 * Upload audio or video file directly to R2 from client
 * Returns the R2 URL for use in generation endpoints
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const fileType = formData.get('type') as string // 'audio' or 'video'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const isAudio = file.type.startsWith('audio/')
    const isVideo = file.type.startsWith('video/')
    
    if (!isAudio && !isVideo) {
      return NextResponse.json({ error: 'File must be audio or video' }, { status: 400 })
    }

    // Validate file size (100MB max)
    const MAX_SIZE = 100 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size must be under 100MB' }, { status: 400 })
    }

    console.log(`📤 Uploading ${fileType} file:`, file.name, `(${(file.size / (1024 * 1024)).toFixed(2)} MB)`)

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Determine bucket and generate filename
    const bucket = isVideo ? 'videos' : 'audio-files'
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-')
    const fileName = `upload-${timestamp}-${sanitizedName}`

    // Upload to R2
    const result = await uploadToR2(buffer, bucket, fileName)

    if (!result.success) {
      console.error('❌ R2 upload failed:', result.error)
      return NextResponse.json(
        { error: 'Failed to upload file to storage' },
        { status: 500 }
      )
    }

    console.log('✅ File uploaded to R2:', result.url)

    return NextResponse.json({
      success: true,
      url: result.url,
      fileName,
      size: file.size,
      type: isVideo ? 'video' : 'audio'
    })

  } catch (error) {
    console.error('❌ Media upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
