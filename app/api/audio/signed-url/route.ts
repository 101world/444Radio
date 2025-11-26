/**
 * Server-side Signed URL Generator
 * Generates HMAC-signed URLs for secure audio access
 * Usage: POST /api/audio/signed-url with { key: 'audio-file.mp3', ttl: 3600 }
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { key, ttl = 3600 } = await request.json();
    
    if (!key) {
      return NextResponse.json({ error: 'Missing audio key' }, { status: 400 });
    }

    // Generate signed URL
    const exp = Math.floor(Date.now() / 1000) + ttl; // TTL in seconds
    const message = `${key}:${exp}`;
    const secret = process.env.AUDIO_SIGNING_SECRET || 'default-secret-change-me';
    
    const signature = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');

    const workerUrl = process.env.AUDIO_WORKER_URL || 'https://audio-worker.your-subdomain.workers.dev';
    const signedUrl = `${workerUrl}/audio/${key}?exp=${exp}&sig=${signature}`;

    return NextResponse.json({
      signedUrl,
      expiresAt: new Date(exp * 1000).toISOString(),
      ttl,
    });
  } catch (error: any) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
