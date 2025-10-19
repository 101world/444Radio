import { S3Client } from '@aws-sdk/client-s3'

// Cloudflare R2 is S3-compatible
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
})

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '444radio-media'
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''

export default r2Client
