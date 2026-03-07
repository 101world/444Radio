/**
 * Assistant Media Upload API
 * POST /api/upload/assistant-media
 * Uploads images, audio, or video files for use with the 444 Assistant.
 * Returns the public URL for the uploaded file.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { uploadToR2 } from '@/lib/r2-upload'
import { corsResponse, handleOptions } from '@/lib/cors'
import { v4 as uuidv4 } from 'uuid'

export const maxDuration = 60

export async function OPTIONS() {
  return handleOptions()
}

const ALLOWED_TYPES: Record<string, { maxSize: number; ext: string }> = {
  'image/jpeg': { maxSize: 7 * 1024 * 1024, ext: 'jpg' },
  'image/png': { maxSize: 7 * 1024 * 1024, ext: 'png' },
  'image/webp': { maxSize: 7 * 1024 * 1024, ext: 'webp' },
  'image/gif': { maxSize: 7 * 1024 * 1024, ext: 'gif' },
  'audio/mpeg': { maxSize: 50 * 1024 * 1024, ext: 'mp3' },
  'audio/mp3': { maxSize: 50 * 1024 * 1024, ext: 'mp3' },
  'audio/wav': { maxSize: 50 * 1024 * 1024, ext: 'wav' },
  'audio/ogg': { maxSize: 50 * 1024 * 1024, ext: 'ogg' },
  'audio/flac': { maxSize: 50 * 1024 * 1024, ext: 'flac' },
  'audio/aac': { maxSize: 50 * 1024 * 1024, ext: 'aac' },
  'audio/webm': { maxSize: 50 * 1024 * 1024, ext: 'webm' },
  'video/mp4': { maxSize: 50 * 1024 * 1024, ext: 'mp4' },
  'video/webm': { maxSize: 50 * 1024 * 1024, ext: 'webm' },
  'video/quicktime': { maxSize: 50 * 1024 * 1024, ext: 'mov' },
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return corsResponse(NextResponse.json({ error: 'No file provided' }, { status: 400 }))
    }

    const typeInfo = ALLOWED_TYPES[file.type]
    if (!typeInfo) {
      return corsResponse(NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 }))
    }

    if (file.size > typeInfo.maxSize) {
      const maxMB = (typeInfo.maxSize / (1024 * 1024)).toFixed(0)
      return corsResponse(NextResponse.json({ error: `File too large. Maximum ${maxMB}MB.` }, { status: 400 }))
    }

    // Determine bucket category for the key prefix
    let category = 'misc'
    if (file.type.startsWith('image/')) category = 'images'
    else if (file.type.startsWith('audio/')) category = 'audio'
    else if (file.type.startsWith('video/')) category = 'video'

    const key = `assistant/${category}/${uuidv4()}.${typeInfo.ext}`

    const result = await uploadToR2(file, '444radio-media', key, file.type)

    if (!result.success) {
      console.error('[assistant-media] Upload failed:', result.error)
      return corsResponse(NextResponse.json({ error: 'Upload failed' }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({ url: result.url }))
  } catch (error) {
    console.error('[assistant-media] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Upload failed' }, { status: 500 }))
  }
}
