/**
 * Plugin Upload API — Presigned URL generation for file uploads from the VST3 plugin.
 * 
 * POST /api/plugin/upload
 * Auth: Bearer <plugin_token>
 * Body: { fileName, fileType, fileSize }
 * Returns: { presignedUrl, publicUrl, key }
 * 
 * Flow: Plugin picks file → gets presigned URL here → PUTs file directly to R2 → uses publicUrl for processing
 */

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { authenticatePlugin } from '@/lib/plugin-auth'
import { corsResponse, handleOptions } from '@/lib/cors'

export const maxDuration = 300

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

export async function POST(req: NextRequest) {
  // ── Auth via plugin token ──
  const authResult = await authenticatePlugin(req)
  if (!authResult.valid) {
    return corsResponse(NextResponse.json({ error: authResult.error }, { status: authResult.status }))
  }

  try {
    let body
    try {
      body = await req.json()
    } catch {
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

    console.log(`[plugin/upload] Presigned URL for ${fileType}: ${fileName} (${((fileSize || 0) / (1024 * 1024)).toFixed(2)} MB) user=${authResult.userId}`)

    const bucket = '444radio-media'
    const timestamp = Date.now()
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '-')
    const key = `plugin-upload-${timestamp}-${sanitizedName}`

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: fileType,
    })

    // Presigned URL valid for 10 minutes
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 })
    const publicUrl = `https://media.444radio.co.in/${key}`

    return corsResponse(NextResponse.json({
      presignedUrl,
      publicUrl,
      key,
      bucket,
    }))
  } catch (error) {
    console.error('[plugin/upload] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Upload setup failed' }, { status: 500 }))
  }
}
