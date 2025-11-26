/**
 * Audio URL Signing Utilities
 * Server-side only - uses Node.js crypto
 */

import crypto from 'crypto';

/**
 * Generate HMAC-signed URL for secure audio access
 * @param key - Audio file key in R2 bucket
 * @param ttl - Time to live in seconds (default: 1 hour)
 * @returns Signed URL with expiration and signature
 */
export function generateSignedUrl(key: string, ttl: number = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const message = `${key}:${exp}`;
  const secret = process.env.AUDIO_SIGNING_SECRET || 'default-secret-change-me';
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  const workerUrl = process.env.AUDIO_WORKER_URL || 'https://audio-worker.your-subdomain.workers.dev';
  return `${workerUrl}/audio/${key}?exp=${exp}&sig=${signature}`;
}
