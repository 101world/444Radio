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
  file: File | Buffer,
  bucketName: string,
  key: string,
  contentType?: string
): Promise<R2UploadResult> {
  try {
    let buffer: Buffer;
    let fileContentType: string;

    if (Buffer.isBuffer(file)) {
      buffer = file;
      fileContentType = contentType || 'audio/mpeg'; // Default to mp3
    } else {
      const arrayBuffer = await (file as File).arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      fileContentType = (file as File).type;
    }

    // Always use 444radio-media bucket (single bucket for all content)
    const actualBucket = '444radio-media'

    const command = new PutObjectCommand({
      Bucket: actualBucket,
      Key: key,
      Body: buffer,
      ContentType: fileContentType,
    })

    await r2Client.send(command)

    // Use R2_PUBLIC_URL for 444radio-media bucket
    const baseUrl = process.env.R2_PUBLIC_URL || 'https://media.444radio.co.in'
    const publicUrl = `${baseUrl}/${key}`

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
