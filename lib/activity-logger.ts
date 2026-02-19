/**
 * 444Radio - Activity Logger
 * 
 * Centralized utility for logging all user activities to database.
 * Used for analytics, auditing, and monitoring.
 * 
 * Usage:
 * ```typescript
 * import { logActivity, logSessionStart, updateSessionActivity } from '@/lib/activity-logger'
 * 
 * // Log a user action
 * await logActivity({
 *   userId: 'user_123',
 *   actionType: 'play',
 *   resourceType: 'media',
 *   resourceId: 'media-uuid',
 *   metadata: { duration: 180 }
 * })
 * 
 * // Start a session
 * await logSessionStart({
 *   userId: 'user_123',
 *   sessionId: 'session-uuid'
 * })
 * ```
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import { headers } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'

// =============== TYPES ===============

export type ActionType =
  | 'login'
  | 'signup'
  | 'logout'
  | 'play'
  | 'like'
  | 'unlike'
  | 'follow'
  | 'unfollow'
  | 'generate_music'
  | 'generate_image'
  | 'generate_video'
  | 'upload'
  | 'release'
  | 'search'
  | 'profile_view'
  | 'share'
  | 'comment'
  | 'playlist_create'
  | 'playlist_add'
  | 'download'
  | 'credit_purchase'
  | 'code_redeem'
  | 'decrypt_unlock'
  | 'page_view'

export type ResourceType = 
  | 'media'
  | 'user'
  | 'credit'
  | 'profile'
  | 'playlist'
  | 'comment'
  | 'code'
  | 'session'

export interface ActivityLogData {
  userId: string
  actionType: ActionType
  resourceType?: ResourceType
  resourceId?: string
  metadata?: Record<string, unknown>
  sessionId?: string
}

export interface SessionData {
  userId: string
  sessionId?: string
  metadata?: Record<string, unknown>
}

// =============== HELPER FUNCTIONS ===============

/**
 * Parse User-Agent header to extract device info
 */
function parseUserAgent(ua: string): {
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown'
  browser: string
  os: string
} {
  const lower = ua.toLowerCase()
  
  // Detect device type
  let deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown' = 'unknown'
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(lower)) {
    deviceType = 'mobile'
  } else if (/ipad|tablet|playbook|silk/i.test(lower)) {
    deviceType = 'tablet'
  } else if (/windows|macintosh|linux/i.test(lower)) {
    deviceType = 'desktop'
  }
  
  // Detect browser
  let browser = 'Unknown'
  if (lower.includes('edg/')) browser = 'Edge'
  else if (lower.includes('chrome')) browser = 'Chrome'
  else if (lower.includes('safari') && !lower.includes('chrome')) browser = 'Safari'
  else if (lower.includes('firefox')) browser = 'Firefox'
  else if (lower.includes('opera') || lower.includes('opr')) browser = 'Opera'
  
  // Detect OS
  let os = 'Unknown'
  if (lower.includes('windows')) os = 'Windows'
  else if (lower.includes('mac os')) os = 'macOS'
  else if (lower.includes('linux')) os = 'Linux'
  else if (lower.includes('android')) os = 'Android'
  else if (lower.includes('ios') || lower.includes('iphone') || lower.includes('ipad')) os = 'iOS'
  
  return { deviceType, browser, os }
}

/**
 * Get IP address from request headers
 */
function getIpAddress(headersList: Headers): string {
  return (
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
    headersList.get('x-real-ip') ||
    headersList.get('cf-connecting-ip') || // Cloudflare
    'unknown'
  )
}

// =============== MAIN FUNCTIONS ===============

/**
 * Log a user activity
 * @param data Activity data
 * @returns Promise<void> - Fire and forget (doesn't block)
 */
export async function logActivity(data: ActivityLogData): Promise<void> {
  try {
    const headersList = await headers()
    const ip = getIpAddress(headersList)
    const userAgent = headersList.get('user-agent') || 'unknown'
    
    // Generate session ID if not provided
    const sessionId = data.sessionId || `session_${data.userId}_${Date.now()}`
    
    // Insert activity log
    await supabaseAdmin.from('activity_logs').insert({
      user_id: data.userId,
      action_type: data.actionType,
      resource_type: data.resourceType,
      resource_id: data.resourceId,
      metadata: data.metadata || {},
      ip_address: ip,
      user_agent: userAgent,
      session_id: sessionId,
      created_at: new Date().toISOString()
    })
    
    // Update session activity if session exists
    if (data.sessionId) {
      await updateSessionActivity(data.sessionId)
    }
  } catch (error) {
    // Fail silently - don't break app if logging fails
    console.error('[Activity Logger] Failed to log activity:', error)
  }
}

/**
 * Start a new user session
 * @param data Session data
 * @returns Session ID
 */
export async function logSessionStart(data: SessionData): Promise<string> {
  try {
    const headersList = await headers()
    const ip = getIpAddress(headersList)
    const userAgent = headersList.get('user-agent') || 'unknown'
    const { deviceType, browser, os } = parseUserAgent(userAgent)
    
    // Generate session ID if not provided
    const sessionId = data.sessionId || uuidv4()
    
    // TODO: Implement IP geolocation (optional - can use Cloudflare headers or GeoIP API)
    const country = headersList.get('cf-ipcountry') || null
    const city = null // Would need GeoIP lookup
    
    // Insert session
    await supabaseAdmin.from('user_sessions').insert({
      user_id: data.userId,
      session_id: sessionId,
      ip_address: ip,
      user_agent: userAgent,
      device_type: deviceType,
      browser,
      os,
      country,
      city,
      last_activity_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    })
    
    return sessionId
  } catch (error) {
    console.error('[Activity Logger] Failed to start session:', error)
    // Return a fallback session ID so app doesn't break
    return `session_${data.userId}_${Date.now()}`
  }
}

/**
 * Update session last activity timestamp
 * @param sessionId Session ID
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('user_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .is('ended_at', null)
  } catch (error) {
    console.error('[Activity Logger] Failed to update session activity:', error)
  }
}

/**
 * End a user session
 * @param sessionId Session ID
 */
export async function endSession(sessionId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('user_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .is('ended_at', null)
  } catch (error) {
    console.error('[Activity Logger] Failed to end session:', error)
  }
}

/**
 * Get user's active session
 * @param userId User ID
 * @returns Session ID or null
 */
export async function getActiveSession(userId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from('user_sessions')
      .select('session_id')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('last_activity_at', { ascending: false })
      .limit(1)
      .single()
    
    return data?.session_id || null
  } catch (error) {
    console.error('[Activity Logger] Failed to get active session:', error)
    return null
  }
}

// =============== CONVENIENCE FUNCTIONS ===============

/**
 * Log a play event
 */
export async function logPlay(userId: string, mediaId: string, metadata?: Record<string, unknown>) {
  return logActivity({
    userId,
    actionType: 'play',
    resourceType: 'media',
    resourceId: mediaId,
    metadata
  })
}

/**
 * Log a like event
 */
export async function logLike(userId: string, mediaId: string) {
  return logActivity({
    userId,
    actionType: 'like',
    resourceType: 'media',
    resourceId: mediaId
  })
}

/**
 * Log an unlike event
 */
export async function logUnlike(userId: string, mediaId: string) {
  return logActivity({
    userId,
    actionType: 'unlike',
    resourceType: 'media',
    resourceId: mediaId
  })
}

/**
 * Log a follow event
 */
export async function logFollow(userId: string, targetUserId: string) {
  return logActivity({
    userId,
    actionType: 'follow',
    resourceType: 'user',
    resourceId: targetUserId
  })
}

/**
 * Log an unfollow event
 */
export async function logUnfollow(userId: string, targetUserId: string) {
  return logActivity({
    userId,
    actionType: 'unfollow',
    resourceType: 'user',
    resourceId: targetUserId
  })
}

/**
 * Log a generation event
 */
export async function logGeneration(
  userId: string, 
  type: 'music' | 'image' | 'video',
  metadata?: Record<string, unknown>
) {
  const actionTypeMap = {
    music: 'generate_music',
    image: 'generate_image',
    video: 'generate_video'
  } as const
  
  return logActivity({
    userId,
    actionType: actionTypeMap[type],
    metadata
  })
}

/**
 * Log a search event
 */
export async function logSearch(userId: string, query: string, results?: number) {
  return logActivity({
    userId,
    actionType: 'search',
    metadata: { query, results }
  })
}

/**
 * Log a profile view
 */
export async function logProfileView(viewerId: string, profileUserId: string) {
  return logActivity({
    userId: viewerId,
    actionType: 'profile_view',
    resourceType: 'user',
    resourceId: profileUserId
  })
}

/**
 * Log a release event
 */
export async function logRelease(userId: string, mediaId: string, metadata?: Record<string, unknown>) {
  return logActivity({
    userId,
    actionType: 'release',
    resourceType: 'media',
    resourceId: mediaId,
    metadata
  })
}

/**
 * Log credit purchase
 */
export async function logCreditPurchase(userId: string, amount: number, usd: number) {
  return logActivity({
    userId,
    actionType: 'credit_purchase',
    resourceType: 'credit',
    metadata: { credits: amount, usd }
  })
}
