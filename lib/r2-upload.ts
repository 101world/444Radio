import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// Initialize R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export interface R2UploadResult {
  success: boolean
  url?: string
  error?: string
}

export async function uploadToR2(
  file: File,
  bucketName: string,
  key: string
): Promise<R2UploadResult> {
  try {
    const buffer = await file.arrayBuffer()

    // Use actual bucket name from env or fallback to specific bucket names
    const actualBucket = process.env.R2_BUCKET_NAME || bucketName

    const command = new PutObjectCommand({
      Bucket: actualBucket,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: file.type,
    })

    await r2Client.send(command)

    // Construct public URL based on bucket type
    // If using separate buckets, use specific URLs; otherwise use main R2_PUBLIC_URL
    let publicUrl = ''
    if (bucketName === 'audio-files' && process.env.NEXT_PUBLIC_R2_AUDIO_URL) {
      publicUrl = `${process.env.NEXT_PUBLIC_R2_AUDIO_URL}/${key}`
    } else if (bucketName === 'images' && process.env.NEXT_PUBLIC_R2_IMAGES_URL) {
      publicUrl = `${process.env.NEXT_PUBLIC_R2_IMAGES_URL}/${key}`
    } else if (bucketName === 'videos' && process.env.NEXT_PUBLIC_R2_VIDEOS_URL) {
      publicUrl = `${process.env.NEXT_PUBLIC_R2_VIDEOS_URL}/${key}`
    } else if (process.env.R2_PUBLIC_URL) {
      // Fallback to main R2_PUBLIC_URL if individual bucket URLs not set
      publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`
    } else {
      console.error('No R2 public URL configured')
      return {
        success: false,
        error: 'R2 public URL not configured'
      }
    }

    console.log(`✅ Uploaded to R2: ${actualBucket}/${key} -> ${publicUrl}`)

    return {
      success: true,
      url: publicUrl,
    }
  } catch (error) {
    console.error('R2 upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    }
  }
}
