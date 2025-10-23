import { ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import r2Client, { R2_BUCKET_NAME, R2_PUBLIC_URL } from './r2-client'
import type { MediaFile, UserMedia } from './types'

/**
 * List all files for a user in a specific folder
 */
export async function listUserFiles(
  userId: string,
  folder: 'music' | 'images' | 'combined'
): Promise<MediaFile[]> {
  try {
    const prefix = `users/${userId}/${folder}/`

    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
    })

    const response = await r2Client.send(command)
    const objects = response.Contents || []

    return objects.map((obj) => ({
      key: obj.Key || '',
      url: `${R2_PUBLIC_URL}/${obj.Key}`,
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
      contentType: 'application/octet-stream', // R2 doesn't return this in list
    }))
  } catch (error) {
    console.error('R2 list error:', error)
    return []
  }
}

/**
 * Get all media for a user (music, images, combined)
 */
export async function getAllUserMedia(userId: string): Promise<UserMedia> {
  const [music, images, combined] = await Promise.all([
    listUserFiles(userId, 'music'),
    listUserFiles(userId, 'images'),
    listUserFiles(userId, 'combined'),
  ])

  return { music, images, combined }
}

/**
 * Get a signed URL for private access (if bucket is private)
 * Expires in 1 hour by default
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })

    const url = await getSignedUrl(r2Client, command, { expiresIn })
    return url
  } catch (error) {
    console.error('R2 signed URL error:', error)
    return ''
  }
}

/**
 * Check if a file exists in R2
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })

    await r2Client.send(command)
    return true
  } catch (_error) {
    return false
  }
}
