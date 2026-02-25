/**
 * Log a credit transaction to the credit_transactions table.
 *
 * Retries up to 2 times on failure (3 total attempts) with exponential backoff.
 * The DB-level deduct_credits function also logs atomically, so this serves
 * as enrichment with full type/description/metadata.
 */

export type CreditTransactionType =
  | 'generation_music'
  | 'generation_resound'
  | 'generation_effects'
  | 'generation_effects_hq'
  | 'generation_loops'
  | 'generation_chords'
  | 'generation_image'
  | 'generation_video_to_audio'
  | 'generation_video'
  | 'generation_lipsync'
  | 'generation_cover_art'
  | 'generation_stem_split'
  | 'generation_audio_boost'
  | 'generation_autotune'
  | 'generation_extract'
  | 'earn_list'
  | 'earn_purchase'
  | 'earn_sale'
  | 'earn_admin'
  | 'credit_award'
  | 'credit_refund'
  | 'wallet_deposit'
  | 'wallet_conversion'
  | 'subscription_bonus'
  | 'plugin_purchase'
  | 'quest_entry'
  | 'quest_reward'
  | 'release'
  | 'code_claim'
  | 'other'

export interface LogTransactionParams {
  userId: string
  amount: number          // negative for spend, positive for earn
  balanceAfter?: number   // credits remaining after this transaction
  type: CreditTransactionType
  status?: 'success' | 'failed' | 'pending'
  description?: string
  metadata?: Record<string, unknown>
}

export async function logCreditTransaction(params: LogTransactionParams): Promise<void> {
  const MAX_RETRIES = 2
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (!supabaseUrl || !supabaseKey) {
        console.error('⚠️ logCreditTransaction: missing SUPABASE env vars (url:', !!supabaseUrl, 'key:', !!supabaseKey, ')')
        return
      }

      const body = {
        user_id: params.userId,
        amount: params.amount,
        balance_after: params.balanceAfter ?? null,
        type: params.type,
        status: params.status || 'success',
        description: params.description || null,
        metadata: { ...(params.metadata ?? {}), source: 'app' },
      }

      console.log('💳 logCreditTransaction:', params.type, params.amount, params.status || 'success', attempt > 0 ? `(retry ${attempt})` : '')

      const res = await fetch(`${supabaseUrl}/rest/v1/credit_transactions`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        console.error('⚠️ Failed to log credit transaction:', res.status, text, JSON.stringify(body))
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 200 * (attempt + 1)))
          continue
        }
      } else {
        console.log('✅ Credit transaction logged:', params.type, params.amount)
        return
      }
    } catch (err) {
      console.error('⚠️ logCreditTransaction error:', err, attempt > 0 ? `(retry ${attempt})` : '')
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)))
        continue
      }
    }
  }
  console.error('🔴 logCreditTransaction: all retries exhausted for', params.type, params.amount)
}

/**
 * After a generation succeeds, patch the most recent deduction transaction
 * for this user+type with the output media_url, media_type, and title.
 * This enables the admin/user transaction UI to show thumbnails & players.
 */
export async function updateTransactionMedia(params: {
  userId: string
  type: CreditTransactionType
  mediaUrl?: string
  mediaType?: 'audio' | 'image' | 'video'
  title?: string
  extraMeta?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) return

    // Find the most recent transaction for this user+type (within last 5 min)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const findRes = await fetch(
      `${supabaseUrl}/rest/v1/credit_transactions?user_id=eq.${params.userId}&type=eq.${params.type}&created_at=gte.${fiveMinAgo}&order=created_at.desc&limit=1&select=id,metadata`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    if (!findRes.ok) return
    const rows = await findRes.json()
    if (!rows?.length) return

    const txn = rows[0]
    const updatedMeta = {
      ...(txn.metadata || {}),
      ...(params.mediaUrl ? { media_url: params.mediaUrl } : {}),
      ...(params.mediaType ? { media_type: params.mediaType } : {}),
      ...(params.title ? { media_title: params.title } : {}),
      ...(params.extraMeta || {}),
      generation_status: 'completed',
    }

    await fetch(
      `${supabaseUrl}/rest/v1/credit_transactions?id=eq.${txn.id}`,
      {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ metadata: updatedMeta }),
      }
    )
    console.log('✅ Transaction media updated:', params.type, params.mediaUrl?.substring(0, 60))
  } catch (err) {
    // Non-critical — don't break the generation flow
    console.error('⚠️ updateTransactionMedia error:', err)
  }
}
