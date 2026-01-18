import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// No body size limit needed - we're generating presigned URLs, not receiving files
export const maxDuration = 60

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

/**
 * POST /api/upload/media
 * Generate a presigned URL for direct upload to R2 from client
 * This bypasses Vercel's body size limits
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse JSON with better error handling
    let body
    try {
      body = await req.json()
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError)
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { fileName, fileType, fileSize } = body

    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'Missing fileName or fileType' }, { status: 400 })
    }

    // Validate file type
    const isAudio = fileType.startsWith('audio/')
    const isVideo = fileType.startsWith('video/')
    
    if (!isAudio && !isVideo) {
      return NextResponse.json({ error: 'File must be audio or video' }, { status: 400 })
    }

    // Validate file size (100MB max)
    const MAX_SIZE = 100 * 1024 * 1024
    if (fileSize && fileSize > MAX_SIZE) {
      return NextResponse.json({ error: 'File size must be under 100MB' }, { status: 400 })
    }

    console.log(`🔑 Generating presigned URL for ${fileType}:`, fileName, `(${(fileSize / (1024 * 1024)).toFixed(2)} MB)`)

    // Determine bucket
    const bucket = isVideo ? 'videos' : 'audio-files'
    const timestamp = Date.now()
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '-')
    const key = `upload-${timestamp}-${sanitizedName}`

    // Generate presigned URL for upload (valid for 10 minutes)
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: fileType,
    })

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 })

    // Construct the public URL that will be accessible after upload
    const publicUrlBase = isVideo 
      ? process.env.NEXT_PUBLIC_R2_VIDEOS_URL 
      : process.env.NEXT_PUBLIC_R2_AUDIO_URL
    const publicUrl = `${publicUrlBase}/${key}`

    console.log('✅ Presigned URL generated:', key)

    return NextResponse.json({
      success: true,
      uploadUrl: presignedUrl,
      publicUrl: publicUrl,
      key: key,
      bucket: bucket
    })

  } catch (error) {
    console.error('❌ Presigned URL generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    )
  }
}
