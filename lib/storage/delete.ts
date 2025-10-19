import { DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import r2Client, { R2_BUCKET_NAME } from './r2-client'
import type { DeleteOptions } from './types'

/**
 * Delete a file from R2 storage
 */
export async function deleteFromR2(options: DeleteOptions): Promise<boolean> {
  try {
    const { key } = options

    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })

    await r2Client.send(command)
    return true
  } catch (error) {
    console.error('R2 delete error:', error)
    return false
  }
}

/**
 * Delete all files for a user in a specific folder
 */
export async function deleteUserFolder(
  userId: string,
  folder: 'music' | 'images' | 'combined'
): Promise<number> {
  try {
    const prefix = `users/${userId}/${folder}/`

    // List all objects with this prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
    })

    const listResponse = await r2Client.send(listCommand)
    const objects = listResponse.Contents || []

    // Delete each object
    let deletedCount = 0
    for (const obj of objects) {
      if (obj.Key) {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: obj.Key,
        })
        await r2Client.send(deleteCommand)
        deletedCount++
      }
    }

    return deletedCount
  } catch (error) {
    console.error('R2 delete folder error:', error)
    return 0
  }
}

/**
 * Delete ALL files for a user (use with caution!)
 */
export async function deleteAllUserFiles(userId: string): Promise<number> {
  try {
    const prefix = `users/${userId}/`

    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
    })

    const listResponse = await r2Client.send(listCommand)
    const objects = listResponse.Contents || []

    let deletedCount = 0
    for (const obj of objects) {
      if (obj.Key) {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: obj.Key,
        })
        await r2Client.send(deleteCommand)
        deletedCount++
      }
    }

    return deletedCount
  } catch (error) {
    console.error('R2 delete all user files error:', error)
    return 0
  }
}
