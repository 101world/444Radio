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

    // Generate unique key with timestamp
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const key = `users/${userId}/${folder}/${timestamp}-${sanitizedFileName}`

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

    return {
      success: true,
      url,
      key,
      size: buffer.length,
    }
  } catch (error) {
    console.error('R2 upload error:', error)
    return {
      success: false,
      url: '',
      key: '',
      size: 0,
      error: error instanceof Error ? error.message : 'Upload failed',
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
    // Fetch file from source URL
    const response = await fetch(sourceUrl)
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const blob = await response.blob()

    // Upload to R2
    return uploadToR2({
      userId,
      file: blob,
      fileName,
      contentType,
      folder,
    })
  } catch (error) {
    console.error('Download and upload error:', error)
    return {
      success: false,
      url: '',
      key: '',
      size: 0,
      error: error instanceof Error ? error.message : 'Download failed',
    }
  }
}
