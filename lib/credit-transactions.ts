/**
 * Log a credit transaction to the credit_transactions table.
 *
 * This is a fire-and-forget helper — failures are logged but
 * never block the calling route.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export type CreditTransactionType =
  | 'generation_music'
  | 'generation_effects'
  | 'generation_loops'
  | 'generation_image'
  | 'generation_video_to_audio'
  | 'generation_cover_art'
  | 'generation_stem_split'
  | 'earn_list'
  | 'earn_purchase'
  | 'earn_sale'
  | 'earn_admin'
  | 'credit_award'
  | 'credit_refund'
  | 'subscription_bonus'
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
  try {
    const body = {
      user_id: params.userId,
      amount: params.amount,
      balance_after: params.balanceAfter ?? null,
      type: params.type,
      status: params.status || 'success',
      description: params.description || null,
      metadata: params.metadata ?? {},
    }

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
      console.error('⚠️ Failed to log credit transaction:', text)
    }
  } catch (err) {
    console.error('⚠️ logCreditTransaction error:', err)
  }
}
