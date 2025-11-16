import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { S3Client, ListBucketsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

/**
 * GET /api/r2/test-connection
 * Test R2 connection and credentials
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if credentials are set
    const hasEndpoint = !!process.env.R2_ENDPOINT
    const hasAccessKey = !!process.env.R2_ACCESS_KEY_ID
    const hasSecretKey = !!process.env.R2_SECRET_ACCESS_KEY
    const hasBucketName = !!process.env.R2_BUCKET_NAME

    if (!hasEndpoint || !hasAccessKey || !hasSecretKey) {
      return NextResponse.json({
        success: false,
        error: 'R2 credentials not configured',
        config: {
          hasEndpoint,
          hasAccessKey,
          hasSecretKey,
          hasBucketName,
          endpoint: hasEndpoint ? process.env.R2_ENDPOINT : 'NOT_SET',
          bucketName: process.env.R2_BUCKET_NAME || 'NOT_SET'
        }
      })
    }

    // Try to connect to R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
      }
    })

    // Test 1: List buckets (may not work with limited permissions)
    let bucketsResult = null
    try {
      const bucketsCommand = new ListBucketsCommand({})
      bucketsResult = await s3Client.send(bucketsCommand)
    } catch (err) {
      console.warn('Could not list buckets (normal if using limited permissions):', err)
    }

    // Test 2: Try to list objects in the configured bucket
    const bucketName = process.env.R2_BUCKET_NAME || '444radio-media'
    let objectsResult = null
    let objectCount = 0
    try {
      const objectsCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 10
      })
      objectsResult = await s3Client.send(objectsCommand)
      objectCount = objectsResult.Contents?.length || 0
    } catch (err: any) {
      return NextResponse.json({
        success: false,
        error: 'Failed to access R2 bucket',
        details: err.message,
        config: {
          endpoint: process.env.R2_ENDPOINT,
          bucketName,
          hasCredentials: true
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'R2 connection successful',
      config: {
        endpoint: process.env.R2_ENDPOINT,
        bucketName,
        publicUrls: {
          audio: process.env.NEXT_PUBLIC_R2_AUDIO_URL,
          images: process.env.NEXT_PUBLIC_R2_IMAGES_URL,
          videos: process.env.NEXT_PUBLIC_R2_VIDEOS_URL,
          main: process.env.R2_PUBLIC_URL
        }
      },
      buckets: bucketsResult?.Buckets?.map(b => b.Name) || ['Could not list (limited permissions)'],
      objectCount,
      sampleObjects: objectsResult?.Contents?.slice(0, 5).map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified
      })) || []
    })

  } catch (error) {
    console.error('R2 connection test error:', error)
    return NextResponse.json({
      success: false,
      error: 'R2 connection test failed',
      details: error instanceof Error ? error.message : String(error)
    })
  }
}
