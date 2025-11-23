import { PutObjectCommand } from '@aws-sdk/client-s3'
import r2Client, { R2_BUCKET_NAME, R2_PUBLIC_URL } from './r2-client'
import type { UploadOptions, UploadResult } from './types'

/**
 * Upload a file to Cloudflare R2 storage
 * Organizes files by user: users/{userId}/{folder}/{timestamp}-{fileName}
 */
export async function uploadToR2(options: UploadOptions): Promise<UploadResult> {
  try {
    const { userId, file, fileName, contentType, folder } = options

    // Validate R2 configuration
    if (!R2_BUCKET_NAME || !R2_PUBLIC_URL) {
      throw new Error('R2 not configured: Missing R2_BUCKET_NAME or R2_PUBLIC_URL')
    }

    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      throw new Error('R2 not configured: Missing R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY')
    }

    // Generate unique key with timestamp
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const key = `users/${userId}/${folder}/${timestamp}-${sanitizedFileName}`

    console.log(`🔧 Preparing upload: ${key}`)

    // Convert file to Buffer if needed
    let buffer: Buffer
    if (file instanceof Buffer) {
      buffer = file
    } else if (file instanceof Blob) {
      const arrayBuffer = await file.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    } else {
      // ReadableStream - collect chunks
      const chunks: Uint8Array[] = []
      const reader = (file as ReadableStream).getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
      buffer = Buffer.concat(chunks)
    }

    console.log(`📤 Uploading ${(buffer.length / 1024 / 1024).toFixed(2)} MB to bucket: ${R2_BUCKET_NAME}`)

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // Make publicly readable
      // Note: Bucket must have public access enabled
    })

    await r2Client.send(command)

    // Construct public URL
    const url = `${R2_PUBLIC_URL}/${key}`

    console.log(`✅ Upload successful: ${url}`)

    return {
      success: true,
      url,
      key,
      size: buffer.length,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Upload failed'
    console.error('❌ R2 upload error:', {
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
      bucket: R2_BUCKET_NAME,
      publicUrl: R2_PUBLIC_URL,
      hasCredentials: {
        accessKeyId: !!process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: !!process.env.R2_SECRET_ACCESS_KEY,
        endpoint: !!process.env.R2_ENDPOINT
      }
    })
    return {
      success: false,
      url: '',
      key: '',
      size: 0,
      error: errorMsg,
    }
  }
}

/**
 * Download a file from URL and upload to R2
 * Used to save Replicate outputs permanently
 */
export async function downloadAndUploadToR2(
  sourceUrl: string,
  userId: string,
  folder: 'music' | 'images',
  fileName: string
): Promise<UploadResult> {
  try {
    console.log(`⬇️ Downloading from ${sourceUrl.substring(0, 80)}...`)
    
    // Fetch file from source URL
    const response = await fetch(sourceUrl)
    if (!response.ok) {
      const errorMsg = `Failed to download: ${response.status} ${response.statusText}`
      console.error(`❌ Download failed:`, errorMsg)
      throw new Error(errorMsg)
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    console.log(`📦 Downloaded ${contentType}, converting to blob...`)
    const blob = await response.blob()
    console.log(`✅ Blob ready: ${(blob.size / 1024 / 1024).toFixed(2)} MB`)

    // Upload to R2
    console.log(`⬆️ Uploading to R2: users/${userId}/${folder}/${fileName}`)
    const result = await uploadToR2({
      userId,
      file: blob,
      fileName,
      contentType,
      folder,
    })

    if (result.success) {
      console.log(`✅ R2 upload complete: ${result.url}`)
    } else {
      console.error(`❌ R2 upload failed: ${result.error}`)
    }

    return result
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Download failed'
    console.error('❌ Download and upload error:', {
      error: errorMsg,
      sourceUrl: sourceUrl.substring(0, 100),
      userId,
      folder,
      fileName
    })
    return {
      success: false,
      url: '',
      key: '',
      size: 0,
      error: errorMsg,
    }
  }
}
