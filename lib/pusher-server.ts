/**
 * Pusher Client for Real-Time Studio Events
 * Broadcasts generation completion events to connected clients
 * 
 * Alternative to WebSocket for serverless Vercel deployment
 * Uses Pusher Channels for real-time updates
 * 
 * Free tier: 200k messages/day, 100 concurrent connections
 * Perfect for studio generation notifications
 */

import Pusher from 'pusher'

let pusherServer: Pusher | null = null

/**
 * Get or create Pusher server instance
 * Used server-side to broadcast events
 */
export function getPusherServer(): Pusher | null {
  // Check if Pusher is configured
  if (!process.env.PUSHER_APP_ID || 
      !process.env.PUSHER_KEY || 
      !process.env.PUSHER_SECRET || 
      !process.env.PUSHER_CLUSTER) {
    console.warn('⚠️ Pusher not configured - real-time updates disabled')
    console.log('Set PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER to enable')
    return null
  }

  if (!pusherServer) {
    pusherServer = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER,
      useTLS: true
    })
    console.log('✅ Pusher server initialized')
  }

  return pusherServer
}

/**
 * Broadcast job completion to user
 * Client will listen on channel `private-user-{userId}` for event `job:completed`
 */
export async function broadcastJobCompleted(
  userId: string,
  jobData: {
    jobId: string
    type: string
    output: Record<string, string>
  }
) {
  const pusher = getPusherServer()
  if (!pusher) {
    console.log('📡 Pusher not configured - skipping broadcast')
    return false
  }

  try {
    await pusher.trigger(
      `private-user-${userId}`,
      'job:completed',
      jobData
    )
    console.log(`📡 Broadcasted job:completed to user ${userId}`, jobData.jobId)
    return true
  } catch (error) {
    console.error('❌ Failed to broadcast:', error)
    return false
  }
}

/**
 * Broadcast job progress update
 */
export async function broadcastJobProgress(
  userId: string,
  jobData: {
    jobId: string
    status: string
    progress?: number
  }
) {
  const pusher = getPusherServer()
  if (!pusher) return false

  try {
    await pusher.trigger(
      `private-user-${userId}`,
      'job:progress',
      jobData
    )
    return true
  } catch (error) {
    console.error('❌ Failed to broadcast progress:', error)
    return false
  }
}

/**
 * Broadcast job failure
 */
export async function broadcastJobFailed(
  userId: string,
  jobData: {
    jobId: string
    error: string
  }
) {
  const pusher = getPusherServer()
  if (!pusher) return false

  try {
    await pusher.trigger(
      `private-user-${userId}`,
      'job:failed',
      jobData
    )
    return true
  } catch (error) {
    console.error('❌ Failed to broadcast failure:', error)
    return false
  }
}
