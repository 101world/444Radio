import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/credits/convert
 * 
 * Converts available wallet balance to credits.
 * After migration 123: converts ALL wallet balance (no $1 retention).
 * $1 minimum is only enforced during generation (in deduct_credits).
 * 
 * Rate: 1 credit = $0.035 USD
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }

    const body = await request.json()
    const amountUsd = body.amount_usd ? parseFloat(body.amount_usd) : null

    // Get current wallet balance
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('wallet_balance, credits')
      .eq('clerk_user_id', userId)
      .single()

    if (fetchError || !user) {
      return corsResponse(
        NextResponse.json({ error: 'User not found' }, { status: 404 })
      )
    }

    const currentWallet = parseFloat(user.wallet_balance || '0')
    const currentCredits = user.credits || 0

    if (currentWallet <= 0) {
      return corsResponse(
        NextResponse.json({ 
          error: 'No wallet balance to convert',
          wallet: currentWallet,
          credits: currentCredits
        }, { status: 400 })
      )
    }

    // Validate amount if specified
    if (amountUsd !== null) {
      if (amountUsd <= 0) {
        return corsResponse(
          NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
        )
      }
      if (amountUsd > currentWallet) {
        return corsResponse(
          NextResponse.json({ 
            error: `Amount exceeds wallet balance ($${currentWallet.toFixed(2)})`,
            wallet: currentWallet
          }, { status: 400 })
        )
      }
    }

    const convertAmount = amountUsd || currentWallet
    console.log(`[Wallet Convert] Converting $${convertAmount} for ${userId} (wallet: $${currentWallet})`)

    // Call convert_wallet_to_credits RPC
    const { data: convertData, error: convertError } = await supabaseAdmin.rpc('convert_wallet_to_credits', {
      p_clerk_user_id: userId,
      p_amount_usd: amountUsd, // null = convert all, otherwise specific amount
    })

    const convertRow = Array.isArray(convertData) ? convertData[0] : convertData

    if (convertError || !convertRow?.success) {
      console.error('[Wallet Convert] Failed:', convertError || convertRow?.error_message)
      return corsResponse(
        NextResponse.json({ 
          error: convertRow?.error_message || 'Conversion failed',
          wallet: currentWallet,
          credits: currentCredits
        }, { status: 400 })
      )
    }

    console.log(`[Wallet Convert] ✅ Converted $${convertAmount} → +${convertRow.credits_added} credits`)
    console.log(`[Wallet Convert] New balance: wallet=$${convertRow.new_wallet_balance}, credits=${convertRow.new_credits}`)

    return corsResponse(
      NextResponse.json({
        success: true,
        amountConverted: convertAmount,
        creditsAdded: convertRow.credits_added,
        newWallet: parseFloat(convertRow.new_wallet_balance),
        newCredits: convertRow.new_credits,
        message: `Converted $${convertAmount.toFixed(2)} → ${convertRow.credits_added} credits`
      })
    )
  } catch (error: any) {
    console.error('[Wallet Convert] Error:', error)
    return corsResponse(
      NextResponse.json({
        error: 'Conversion failed',
        message: error.message
      }, { status: 500 })
    )
  }
}
