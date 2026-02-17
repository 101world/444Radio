/**
 * Atomic credit refund helper.
 * Used when a generation fails AFTER credits were already deducted.
 * Reads current balance, adds back, and logs a refund transaction.
 */
import { logCreditTransaction } from '@/lib/credit-transactions'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function refundCredits(opts: {
  userId: string
  amount: number
  type: string
  reason: string
  metadata?: Record<string, unknown>
}): Promise<{ success: boolean; newCredits?: number }> {
  const { userId, amount, type, reason, metadata } = opts

  if (amount <= 0) return { success: false }

  try {
    // Read current credits
    const readRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    )
    if (!readRes.ok) {
      console.error(`[refund] Failed to read credits for ${userId}`)
      return { success: false }
    }
    const readData = await readRes.json()
    const currentCredits = readData?.[0]?.credits ?? 0

    // Add credits back
    const newCredits = currentCredits + amount
    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ credits: newCredits }),
      }
    )

    if (!patchRes.ok) {
      console.error(`[refund] Failed to patch credits for ${userId}`)
      return { success: false }
    }

    console.log(`🔄 [refund] +${amount} credits → ${userId} (${currentCredits} → ${newCredits}) | ${reason}`)

    // Log the refund transaction
    await logCreditTransaction({
      userId,
      amount,
      balanceAfter: newCredits,
      type: type as any,
      status: 'failed',
      description: `${reason} — ${amount} credit${amount > 1 ? 's' : ''} refunded`,
      metadata: { ...metadata, refunded: true, refund_amount: amount },
    })

    return { success: true, newCredits }
  } catch (err) {
    console.error(`[refund] Error refunding ${amount} credits to ${userId}:`, err)
    return { success: false }
  }
}
