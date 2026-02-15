import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function OPTIONS() {
  return handleOptions()
}

// ── POST /api/wallet/convert ──
// Converts wallet dollars → credits, keeping $1.00 minimum in wallet.
// Body: { amount_usd?: number }  — null/omit = convert all available.
// Rate: 1 credit = $0.035 USD.
export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await request.json().catch(() => ({}))
    const amountUsd = body.amount_usd != null ? parseFloat(body.amount_usd) : null

    if (amountUsd !== null && (isNaN(amountUsd) || amountUsd <= 0)) {
      return corsResponse(
        NextResponse.json({ error: 'amount_usd must be a positive number' }, { status: 400 })
      )
    }

    // Call the atomic RPC
    const { data, error } = await supabaseAdmin.rpc('convert_wallet_to_credits', {
      p_clerk_user_id: userId,
      p_amount_usd: amountUsd,
    })

    if (error) {
      console.error('[Wallet Convert] RPC error:', error)
      return corsResponse(
        NextResponse.json({ error: 'Conversion failed', details: error.message }, { status: 500 })
      )
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row || !row.success) {
      return corsResponse(
        NextResponse.json({
          error: row?.error_message || 'Conversion failed',
          walletBalance: row?.new_wallet_balance ?? 0,
          credits: row?.new_credits ?? 0,
        }, { status: 400 })
      )
    }

    console.log(`[Wallet Convert] ✅ ${userId}: +${row.credits_added} credits, wallet=$${row.new_wallet_balance}`)

    return corsResponse(
      NextResponse.json({
        success: true,
        creditsAdded: row.credits_added,
        walletBalance: parseFloat(row.new_wallet_balance),
        credits: row.new_credits,
      })
    )
  } catch (err: any) {
    console.error('[Wallet Convert] Error:', err)
    return corsResponse(
      NextResponse.json({ error: 'Internal error', message: err.message }, { status: 500 })
    )
  }
}
