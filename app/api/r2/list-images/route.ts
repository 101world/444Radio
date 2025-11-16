import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

/**
 * GET /api/r2/list-images
 * Lists image files from R2 bucket (user-scoped by default)
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if R2 credentials are configured
    if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      console.warn('⚠️ R2 credentials not configured, returning empty list')
      return NextResponse.json({
        success: true,
        images: [],
        total: 0,
        message: 'R2 storage not configured'
      })
    }

    // Allow optional query param all=true for admin/full listing (not filtered by user)
    const url = new URL(request.url)
    const listAllParam = url.searchParams.get('all') === 'true'
    // User-specific prefix for images
    const userPrefix = `users/${userId}/images/`

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
      }
    })

    const imagesBaseUrl = process.env.NEXT_PUBLIC_R2_IMAGES_URL || 'https://pub-e5b60d303c5547e891ae88829c469ed6.r2.dev'
    const configuredImagesBucket = process.env.R2_IMAGES_BUCKET_NAME || process.env.R2_BUCKET_NAME
    const bucketName = (configuredImagesBucket && configuredImagesBucket.trim().length > 0) ? configuredImagesBucket : 'images'

    const listAll = async (bucket: string, prefix?: string) => {
      let isTruncated: boolean = true
      let continuationToken: string | undefined = undefined
      const objects: any[] = []
      while (isTruncated) {
        const resp: any = await s3Client.send(new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
          Prefix: prefix
        }))
        const page: any[] = resp?.Contents || []
        objects.push(...page)
        isTruncated = !!resp?.IsTruncated
        continuationToken = resp?.NextContinuationToken
      }
      return objects
    }

    console.log('🖼️ Listing images bucket:', bucketName, 'prefix:', listAllParam ? '(all objects)' : userPrefix)
    const listed = await listAll(bucketName, listAllParam ? undefined : userPrefix)
    
    // Filter for image file extensions and map to library format
    const images = (listed || [])
      .filter(f => !!f.Key && /\.(jpg|jpeg|png|webp|gif)$/i.test(f.Key))
      .map((file, index) => {
        const key: string = file.Key
        // Extract original filename for title
        const baseName = key.split('/').pop() || key
        const title = baseName.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '')
        return {
          id: `r2_${key.replace(/[^a-zA-Z0-9]/g, '_')}`,
          title: title || `Image ${index + 1}`,
          prompt: 'Generated image',
          image_url: `${imagesBaseUrl}/${key}`,
          created_at: (file.LastModified ? new Date(file.LastModified).toISOString() : new Date().toISOString()),
          file_size: file.Size || 0,
          source: 'r2'
        }
      })

    console.log(`✅ Found ${images.length} R2 images for user ${userId}`)

    return NextResponse.json({
      success: true,
      images: images,
      total: images.length,
      bucketUsed: bucketName,
      prefixUsed: listAllParam ? '(all)' : userPrefix,
      scope: listAllParam ? 'all' : 'user'
    })

  } catch (error) {
    console.error('❌ R2 list-images error:', error)
    // Return empty array instead of error to prevent UI breakage
    return NextResponse.json(
      { 
        success: true,
        images: [],
        total: 0,
        error: error instanceof Error ? error.message : String(error)
      }
    )
  }
}
