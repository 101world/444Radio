import { NextResponse } from 'next/server'

/**
 * GET /api/debug/deploy-info
 * Returns deployment and env info to verify production is on the latest commit
 */
export async function GET() {
  try {
    const info = {
      success: true,
      git: {
        sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
        message: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
        branch: process.env.VERCEL_GIT_COMMIT_REF || null,
        repo: process.env.VERCEL_GIT_REPO_SLUG || null,
        org: process.env.VERCEL_GIT_REPO_OWNER || null,
      },
      runtime: {
        nodeEnv: process.env.NODE_ENV || null,
        vercel: !!process.env.VERCEL,
      },
      r2: {
        endpointSet: !!process.env.R2_ENDPOINT,
        bucketName: process.env.R2_BUCKET_NAME || null,
        publicAudioUrl: process.env.NEXT_PUBLIC_R2_AUDIO_URL || null,
        hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
      }
    }
    return NextResponse.json(info)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
