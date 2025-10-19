// Cloudflare R2 Storage Library
// S3-compatible storage for permanent media hosting

export { default as r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from './r2-client'

export {
  uploadToR2,
  downloadAndUploadToR2,
} from './upload'

export {
  deleteFromR2,
  deleteUserFolder,
  deleteAllUserFiles,
} from './delete'

export {
  listUserFiles,
  getAllUserMedia,
  getSignedDownloadUrl,
  fileExists,
} from './download'

export type {
  UploadOptions,
  UploadResult,
  DeleteOptions,
  MediaFile,
  UserMedia,
} from './types'
