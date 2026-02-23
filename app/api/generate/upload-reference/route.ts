import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { uploadToR2 } from '@/lib/storage'

// Allow large file uploads (up to 20MB for voice/instrumental files)
export const maxDuration = 60

export function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/generate/upload-reference
 * 
 * Upload a voice or instrumental reference file to R2.
 * Returns a permanent URL that can be used with music-01 generation.
 * Files must be .wav or .mp3, longer than 15 seconds, max 20MB.
 * 
 * Accepts multipart/form-data with:
 * - file: the audio file
 * - type: 'voice' | 'instrumental' | 'song'
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const refType = formData.get('type') as string || 'voice'

    if (!file) {
      return corsResponse(NextResponse.json({ error: 'No file provided' }, { status: 400 }))
    }

    // Validate file type
    const validTypes = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mpeg', 'audio/mp3']
    const ext = file.name.split('.').pop()?.toLowerCase()
    const isValidType = validTypes.includes(file.type) || ext === 'wav' || ext === 'mp3'

    if (!isValidType) {
      return corsResponse(NextResponse.json({ error: 'File must be .wav or .mp3 format' }, { status: 400 }))
    }

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024
    if (file.size > maxSize) {
      return corsResponse(NextResponse.json({ error: 'File must be less than 20MB' }, { status: 400 }))
    }

    // Validate minimum size (roughly >15 seconds at low bitrate = ~60KB minimum)
    if (file.size < 30000) {
      return corsResponse(NextResponse.json({ error: 'File appears too short. Must be longer than 15 seconds.' }, { status: 400 }))
    }

    // Upload to R2
    const folder = 'music' as const
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${refType}-ref-${timestamp}-${sanitizedName}`

    console.log(`📤 Uploading ${refType} reference: ${fileName} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)

    const result = await uploadToR2({
      userId,
      file: file,
      fileName,
      contentType: file.type || 'audio/wav',
      folder,
    })

    if (!result.success) {
      console.error('❌ R2 upload failed:', result.error)
      return corsResponse(NextResponse.json({ error: 'Upload failed' }, { status: 500 }))
    }

    console.log(`✅ ${refType} reference uploaded:`, result.url)

    return corsResponse(NextResponse.json({
      success: true,
      url: result.url,
      type: refType,
      fileName: file.name,
      size: file.size,
    }))

  } catch (error) {
    console.error('❌ Reference upload error:', error)
    return corsResponse(NextResponse.json({ error: 'Upload failed' }, { status: 500 }))
  }
}
