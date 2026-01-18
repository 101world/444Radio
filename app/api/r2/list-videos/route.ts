import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

/**
 * GET /api/r2/list-videos
 * Lists video files from R2 bucket (user-scoped by default)
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
        videos: [],
        total: 0,
        message: 'R2 storage not configured'
      })
    }

    // Allow optional query param all=true for admin/full listing (not filtered by user)
    const url = new URL(request.url)
    const listAllParam = url.searchParams.get('all') === 'true'

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
      }
    })

    // Videos are stored in 444radio-media bucket
    const videosBaseUrl = process.env.NEXT_PUBLIC_R2_VIDEOS_URL || 'https://pub-e5b60d303c5547e891ae88829c469ed6.r2.dev'
    const bucketName = '444radio-media'

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

    console.log('🎥 Listing videos bucket:', bucketName, 'user:', userId, 'scope:', listAllParam ? 'ALL' : 'user files')
    const listed = await listAll(bucketName, undefined) // List all, filter later
    
    // Filter for video file extensions and map to library format
    const videos = (listed || [])
      .filter(f => !!f.Key && /\.(mp4|webm|mov|avi)$/i.test(f.Key))
      // Filter by userId - files are stored with userId/ prefix or userId in path
      .filter(f => {
        if (listAllParam) return true; // Admin mode
        const key = f.Key as string;
        return key.startsWith(`${userId}/`) || key.includes(`/${userId}/`) || key.startsWith(`users/${userId}/`);
      })
      .map((file, index) => {
        const key: string = file.Key
        // Extract original filename for title
        const baseName = key.split('/').pop() || key
        const title = baseName.replace(/\.(mp4|webm|mov|avi)$/i, '')
        return {
          id: `r2_${key.replace(/[^a-zA-Z0-9]/g, '_')}`,
          title: title || `Video ${index + 1}`,
          prompt: 'Generated video with synced audio',
          audioUrl: `${videosBaseUrl}/${key}`,
          audio_url: `${videosBaseUrl}/${key}`,
          media_url: `${videosBaseUrl}/${key}`,
          created_at: (file.LastModified ? new Date(file.LastModified).toISOString() : new Date().toISOString()),
          file_size: file.Size || 0,
          source: 'r2'
        }
      })

    console.log(`✅ Found ${videos.length} R2 videos for user ${userId}`)

    return NextResponse.json({
      success: true,
      videos: videos,
      total: videos.length,
      bucketUsed: bucketName,
      scope: listAllParam ? 'all' : 'user'
    })

  } catch (error) {
    console.error('❌ R2 list-videos error:', error)
    // Return empty array instead of error to prevent UI breakage
    return NextResponse.json(
      { 
        success: true,
        videos: [],
        total: 0,
        error: error instanceof Error ? error.message : String(error)
      }
    )
  }
}
