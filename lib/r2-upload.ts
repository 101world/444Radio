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

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: file.type,
    })

    await r2Client.send(command)

    // Construct public URL based on bucket
    let publicUrl = ''
    if (bucketName === 'audio-files') {
      publicUrl = `${process.env.NEXT_PUBLIC_R2_AUDIO_URL}/${key}`
    } else if (bucketName === 'images') {
      publicUrl = `${process.env.NEXT_PUBLIC_R2_IMAGES_URL}/${key}`
    } else if (bucketName === 'videos') {
      publicUrl = `${process.env.NEXT_PUBLIC_R2_VIDEOS_URL}/${key}`
    }

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
