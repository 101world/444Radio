import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { corsResponse, handleOptions } from '@/lib/cors'

// Allow larger uploads through API (100MB max for Vercel Pro)
export const maxDuration = 300
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
}

export const runtime = 'nodejs'

export async function OPTIONS() {
  return handleOptions()
}

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
 * Two modes:
 * 1. JSON body {fileName, fileType, fileSize} → returns presigned URL (for direct upload)
 * 2. FormData with file → uploads via server (bypass CORS, but slower)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const contentType = req.headers.get('content-type') || ''

    // MODE 1: Generate presigned URL for direct client upload (requires CORS)
    if (contentType.includes('application/json')) {
      // Parse JSON with better error handling
      let body
      try {
        body = await req.json()
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError)
        return corsResponse(NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }))
      }

      const { fileName, fileType, fileSize } = body

      if (!fileName || !fileType) {
        return corsResponse(NextResponse.json({ error: 'Missing fileName or fileType' }, { status: 400 }))
      }

      // Validate file type
      const isAudio = fileType.startsWith('audio/')
      const isVideo = fileType.startsWith('video/')
      
      if (!isAudio && !isVideo) {
        return corsResponse(NextResponse.json({ error: 'File must be audio or video' }, { status: 400 }))
      }

      // Validate file size (100MB max)
      const MAX_SIZE = 100 * 1024 * 1024
      if (fileSize && fileSize > MAX_SIZE) {
        return corsResponse(NextResponse.json({ error: 'File size must be under 100MB' }, { status: 400 }))
      }

      console.log(`🔑 Generating presigned URL for ${fileType}:`, fileName, `(${(fileSize / (1024 * 1024)).toFixed(2)} MB)`)

      // Determine bucket
      const bucket = isVideo ? '444radio-media' : 'audio-files'
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
      console.log('🌐 Public URL will be:', publicUrl)
      console.log('🔗 Base URL:', publicUrlBase)

      return corsResponse(NextResponse.json({
        success: true,
        mode: 'presigned',
        uploadUrl: presignedUrl,
        publicUrl: publicUrl,
        key: key,
        bucket: bucket
      }))
    }

    // MODE 2: Server-side upload via FormData (no CORS needed, but uses Vercel bandwidth)
    else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File
      
      if (!file) {
        return corsResponse(NextResponse.json({ error: 'No file provided' }, { status: 400 }))
      }

      const isAudio = file.type.startsWith('audio/')
      const isVideo = file.type.startsWith('video/')
      
      if (!isAudio && !isVideo) {
        return corsResponse(NextResponse.json({ error: 'File must be audio or video' }, { status: 400 }))
      }

      console.log(`📤 Server-side upload: ${file.type}`, file.name, `(${(file.size / (1024 * 1024)).toFixed(2)} MB)`)

      const bucket = isVideo ? '444radio-media' : 'audio-files'
      const timestamp = Date.now()
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-')
      const key = `upload-${timestamp}-${sanitizedName}`

      // Convert file to buffer
      const buffer = Buffer.from(await file.arrayBuffer())

      // Upload directly to R2
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })

      await s3Client.send(command)

      const publicUrlBase = isVideo 
        ? process.env.NEXT_PUBLIC_R2_VIDEOS_URL 
        : process.env.NEXT_PUBLIC_R2_AUDIO_URL
      const publicUrl = `${publicUrlBase}/${key}`

      console.log('✅ Server-side upload complete:', publicUrl)

      return corsResponse(NextResponse.json({
        success: true,
        mode: 'server',
        url: publicUrl,
        key: key,
        bucket: bucket
      }))
    }

    return corsResponse(NextResponse.json({ error: 'Invalid content type' }, { status: 400 }))

  } catch (error) {
    console.error('❌ Upload error:', error)
    return corsResponse(NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    ))
  }
}
