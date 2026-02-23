import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Presigned URL flow — no large body hits Vercel (4.5 MB serverless limit)
export const maxDuration = 60

export function OPTIONS() {
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
 * POST /api/generate/upload-reference
 *
 * Returns a presigned URL so the client can upload the file directly to R2,
 * bypassing Vercel's 4.5 MB body-size limit on serverless functions.
 *
 * Accepts JSON body:
 *   { fileName, fileType, fileSize, type: 'voice' | 'instrumental' | 'song' }
 *
 * Returns:
 *   { success, uploadUrl (presigned PUT), publicUrl, type }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const { fileName, fileType, fileSize, type: refType = 'voice' } = body

    if (!fileName || !fileType) {
      return corsResponse(NextResponse.json({ error: 'Missing fileName or fileType' }, { status: 400 }))
    }

    // Validate file type
    const validTypes = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg']
    const ext = fileName.split('.').pop()?.toLowerCase()
    const isValidType = validTypes.includes(fileType) || ['wav', 'mp3', 'webm', 'ogg'].includes(ext || '')

    if (!isValidType) {
      return corsResponse(NextResponse.json({ error: 'File must be .wav, .mp3, .webm or .ogg format' }, { status: 400 }))
    }

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024
    if (fileSize && fileSize > maxSize) {
      return corsResponse(NextResponse.json({ error: 'File must be less than 20MB' }, { status: 400 }))
    }

    // Validate minimum size (roughly >15 seconds at low bitrate = ~30KB minimum)
    if (fileSize && fileSize < 30000) {
      return corsResponse(NextResponse.json({ error: 'File appears too short. Must be longer than 15 seconds.' }, { status: 400 }))
    }

    // Build R2 key
    const timestamp = Date.now()
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const key = `${refType}-ref-${timestamp}-${sanitizedName}`
    const bucket = '444radio-media'

    console.log(`🔑 Generating presigned URL for ${refType} reference: ${key} (${fileSize ? (fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'unknown size'})`)

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: fileType,
    })

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 })

    const publicUrlBase = process.env.NEXT_PUBLIC_R2_AUDIO_URL
    const publicUrl = `${publicUrlBase}/${key}`

    console.log(`✅ Presigned URL generated for ${refType} reference:`, key)

    return corsResponse(NextResponse.json({
      success: true,
      uploadUrl: presignedUrl,
      publicUrl,
      type: refType,
    }))
  } catch (error) {
    console.error('❌ Reference upload error:', error)
    return corsResponse(NextResponse.json({ error: 'Upload failed' }, { status: 500 }))
  }
}
