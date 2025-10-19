// Cloudflare R2 Storage Types

export interface UploadOptions {
  userId: string
  file: Buffer | Blob | ReadableStream
  fileName: string
  contentType: string
  folder: 'music' | 'images' | 'combined'
}

export interface UploadResult {
  success: boolean
  url: string
  key: string
  size: number
  error?: string
}

export interface DeleteOptions {
  userId: string
  key: string
}

export interface MediaFile {
  key: string
  url: string
  size: number
  lastModified: Date
  contentType: string
}

export interface UserMedia {
  music: MediaFile[]
  images: MediaFile[]
  combined: MediaFile[]
}
