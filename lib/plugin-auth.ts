/**
 * Plugin Auth Helper
 * 
 * Validates Bearer tokens from the VST3 plugin.
 * Plugin sends: Authorization: Bearer <plugin_token>
 * This validates against plugin_tokens table and returns the user ID.
 */

import { NextRequest } from 'next/server'

export interface PluginAuthResult {
  userId: string
  tokenId: string
  accessTier: 'studio' | 'pro' | 'purchased'
  valid: true
}

export interface PluginAuthError {
  valid: false
  error: string
  status: number
  accessTier?: 'denied_inactive' | 'denied_no_purchase' | null
}

export type PluginAuth = PluginAuthResult | PluginAuthError

/**
 * Authenticate a plugin request via Bearer token.
 * Usage:
 *   const authResult = await authenticatePlugin(req)
 *   if (!authResult.valid) return corsResponse(NextResponse.json({ error: authResult.error }, { status: authResult.status }))
 *   const { userId } = authResult
 */
export async function authenticatePlugin(req: NextRequest): Promise<PluginAuth> {
  const authHeader = req.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[plugin-auth] No Bearer header present')
    return { valid: false, error: 'No plugin token provided. Open Settings → Plugin tab to generate one.', status: 401 }
  }
  
  const token = authHeader.substring(7).trim()
  
  if (!token || token.length < 32) {
    console.warn('[plugin-auth] Token too short:', token.length, 'chars')
    return { valid: false, error: 'Invalid token format. Generate a new token from Settings → Plugin tab.', status: 401 }
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  try {
    // Call the validate_plugin_token database function
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/validate_plugin_token`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_token: token }),
    })
    
    if (!res.ok) {
      console.error('Plugin auth DB error:', res.status, await res.text().catch(() => ''))
      return { valid: false, error: 'Authentication service error', status: 500 }
    }
    
    const rows = await res.json()
    const result = Array.isArray(rows) ? rows[0] : rows
    
    if (!result || !result.is_valid) {
      const errMsg = result?.error_message || 'Invalid token'
      const tier = result?.access_tier || null
      console.warn('[plugin-auth] Token validation failed:', errMsg, 'tier:', tier)
      
      // Map DB errors to user-friendly messages with tier context
      let userError: string
      let httpStatus = 401
      
      if (tier === 'denied_inactive') {
        userError = 'Your Studio subscription is inactive. Please resubscribe at 444radio.co.in/pricing to use the plugin.'
        httpStatus = 403
      } else if (tier === 'denied_no_purchase') {
        userError = 'Plugin access requires a $25 one-time purchase or a Pro/Studio subscription. Visit 444radio.co.in/pricing.'
        httpStatus = 403
      } else if (errMsg.includes('revoked')) {
        userError = 'Token has been revoked. Generate a new token from Settings → Plugin tab.'
      } else if (errMsg.includes('expired')) {
        userError = 'Token has expired. Generate a new token from Settings → Plugin tab.'
      } else if (errMsg.includes('rate limit')) {
        userError = errMsg
        httpStatus = 429
      } else {
        userError = 'Invalid or expired token. Generate a new one from Settings → Plugin tab.'
      }
      
      return { 
        valid: false, 
        error: userError, 
        status: httpStatus,
        accessTier: tier as 'denied_inactive' | 'denied_no_purchase' | null
      }
    }
    
    return {
      valid: true,
      userId: result.user_id,
      tokenId: result.token_id,
      accessTier: result.access_tier || 'pro',
    }
  } catch (err) {
    console.error('Plugin auth error:', err)
    return { valid: false, error: 'Authentication failed', status: 500 }
  }
}

/**
 * Generate a cryptographically secure plugin token.
 * Format: 444r_<64 hex chars>
 */
export function generatePluginToken(): string {
  const crypto = require('crypto')
  return `444r_${crypto.randomBytes(32).toString('hex')}`
}

/**
 * Get user credits for plugin context.
 */
export async function getPluginUserCredits(userId: string): Promise<{ credits: number; totalGenerated: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const res = await fetch(
    `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,total_generated`,
    {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    }
  )

  if (!res.ok) return { credits: 0, totalGenerated: 0 }
  const data = await res.json()
  const user = data?.[0]
  return { credits: user?.credits || 0, totalGenerated: user?.total_generated || 0 }
}

/**
 * Deduct credits atomically via deduct_credits RPC.
 */
export async function deductPluginCredits(userId: string, amount: number): Promise<{ success: boolean; newCredits: number; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_clerk_user_id: userId, p_amount: amount }),
  })

  if (!res.ok) return { success: false, newCredits: 0, error: 'Credit deduction failed' }

  const raw = await res.json()
  const result = Array.isArray(raw) ? raw[0] : raw

  if (!result?.success) return { success: false, newCredits: 0, error: result?.error_message || 'Insufficient credits' }

  return { success: true, newCredits: result.new_credits }
}

/**
 * Create a plugin job record for async tracking.
 */
export async function createPluginJob(params: {
  jobId: string
  userId: string
  type: string
  creditsCost: number
  inputParams: Record<string, unknown>
}): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const res = await fetch(`${supabaseUrl}/rest/v1/plugin_jobs`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: params.jobId,
      clerk_user_id: params.userId,
      type: params.type,
      status: 'queued',
      credits_cost: params.creditsCost,
      params: params.inputParams,
    }),
  })

  return res.ok
}

/**
 * Update a plugin job status.
 */
export async function updatePluginJob(jobId: string, update: {
  status?: string
  replicatePredictionId?: string
  output?: Record<string, unknown>
  error?: string
}): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const body: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (update.status) body.status = update.status
  if (update.replicatePredictionId) body.replicate_prediction_id = update.replicatePredictionId
  if (update.output) body.output = update.output
  if (update.error) body.error = update.error
  if (update.status === 'completed' || update.status === 'failed') body.completed_at = new Date().toISOString()

  await fetch(`${supabaseUrl}/rest/v1/plugin_jobs?id=eq.${jobId}`, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  })
}
