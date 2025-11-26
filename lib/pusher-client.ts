/**
 * Pusher Client for Real-Time Studio Events
 * Listens for generation completion events from server
 * 
 * Usage in React components:
 * 
 * import { usePusher } from '@/lib/pusher-client'
 * 
 * function MyComponent() {
 *   const pusher = usePusher(userId)
 *   
 *   useEffect(() => {
 *     if (!pusher) return
 *     
 *     pusher.bind('job:completed', (data) => {
 *       console.log('Job completed:', data)
 *       // Add track to timeline automatically
 *     })
 *   }, [pusher])
 * }
 */

import { useEffect, useState } from 'react'
import PusherJS from 'pusher-js'

let pusherClient: PusherJS | null = null

/**
 * Get or create Pusher client instance
 * Used client-side to receive events
 */
export function getPusherClient(): PusherJS | null {
  if (typeof window === 'undefined') return null

  // Check if Pusher is configured
  const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY
  const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER

  if (!pusherKey || !pusherCluster) {
    console.warn('⚠️ Pusher not configured - real-time updates disabled')
    return null
  }

  if (!pusherClient) {
    pusherClient = new PusherJS(pusherKey, {
      cluster: pusherCluster,
      authEndpoint: '/api/pusher/auth', // For private channels
    })
    console.log('✅ Pusher client initialized')
  }

  return pusherClient
}

/**
 * React hook for Pusher real-time events
 * Automatically subscribes to user's private channel
 * 
 * @param userId - Clerk user ID
 * @returns Pusher channel or null if not configured
 */
export function usePusher(userId: string | null | undefined) {
  const [channel, setChannel] = useState<any>(null)

  useEffect(() => {
    if (!userId) return

    const pusher = getPusherClient()
    if (!pusher) {
      console.log('📡 Pusher not configured - using polling fallback')
      return
    }

    // Subscribe to user's private channel
    const userChannel = pusher.subscribe(`private-user-${userId}`)

    userChannel.bind('pusher:subscription_succeeded', () => {
      console.log('✅ Connected to Pusher channel:', `private-user-${userId}`)
    })

    userChannel.bind('pusher:subscription_error', (error: any) => {
      console.error('❌ Pusher subscription error:', error)
    })

    setChannel(userChannel)

    // Cleanup on unmount
    return () => {
      userChannel.unbind_all()
      pusher.unsubscribe(`private-user-${userId}`)
      setChannel(null)
    }
  }, [userId])

  return channel
}

/**
 * Type definitions for Pusher events
 */
export interface JobCompletedEvent {
  jobId: string
  type: 'create-song' | 'create-beat' | 'stem-split' | 'auto-tune' | 'effects'
  output: Record<string, string>
}

export interface JobProgressEvent {
  jobId: string
  status: string
  progress?: number
}

export interface JobFailedEvent {
  jobId: string
  error: string
}
