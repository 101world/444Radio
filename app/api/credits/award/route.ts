import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { logCreditTransaction } from '@/lib/credit-transactions'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// ──────────────────────────────────────────────
// Hardcoded credit codes — ONE TIME USE PER USER
// ──────────────────────────────────────────────
interface CodeConfig {
  credits: number
  description: string
}

const VALID_CODES: Record<string, CodeConfig> = {
  'FREE THE MUSIC': { credits: 20,  description: 'Decrypt puzzle — 20 credits' },
  '444OG79RIZZ':    { credits: 444, description: 'Admin code — 444 credits' },
  '444ISAHOMIE':    { credits: 100, description: 'Secret code — 100 credits' },
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { code } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid code format' },
        { status: 400 }
      )
    }

    const normalizedCode = code.toUpperCase().trim()
    const codeConfig = VALID_CODES[normalizedCode]

    if (!codeConfig) {
      return NextResponse.json(
        { success: false, error: 'Invalid authentication code' },
        { status: 400 }
      )
    }

    // ── Check if this user has EVER redeemed this code ──
    const { data: existingRedemption, error: checkError } = await supabase
      .from('code_redemptions')
      .select('id, redeemed_at, redemption_count')
      .eq('clerk_user_id', userId)
      .eq('code', normalizedCode)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = "no rows" which is fine
      console.error('Error checking redemption:', checkError)
      return NextResponse.json(
        { success: false, error: 'Failed to verify code status' },
        { status: 500 }
      )
    }

    // ── HARD BLOCK: already redeemed = permanently blocked ──
    if (existingRedemption) {
      console.log(`⛔ Code "${normalizedCode}" already redeemed by ${userId} on ${existingRedemption.redeemed_at} (count: ${existingRedemption.redemption_count})`)
      return NextResponse.json(
        {
          success: false,
          error: 'This code has already been claimed. Each code can only be used once per account — ever.',
          alreadyClaimed: true,
        },
        { status: 400 }
      )
    }

    // ── Award credits ──
    const creditsToAward = codeConfig.credits

    // Get current credits
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single()

    if (fetchError) {
      console.error('Error fetching user:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user data' },
        { status: 500 }
      )
    }

    const currentCredits = userData?.credits || 0
    const newCredits = currentCredits + creditsToAward

    // Update credits on users table
    const { error: updateError } = await supabase
      .from('users')
      .update({
        credits: newCredits,
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', userId)

    if (updateError) {
      console.error('Error updating credits:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update credits' },
        { status: 500 }
      )
    }

    // ── Record redemption (permanent, non-deletable) ──
    const { error: insertError } = await supabase
      .from('code_redemptions')
      .insert({
        clerk_user_id: userId,
        code: normalizedCode,
        credits_awarded: creditsToAward,
        redeemed_at: new Date().toISOString(),
        redemption_count: 1,
      })

    if (insertError) {
      console.error('Error recording redemption:', insertError)
      // Credits already awarded — log but don't fail
    }

    // ── Log to credit_transactions (wallet history) ──
    await logCreditTransaction({
      userId,
      amount: creditsToAward,
      balanceAfter: newCredits,
      type: 'code_claim',
      status: 'success',
      description: `Code claimed: ${normalizedCode} — +${creditsToAward} credits`,
      metadata: {
        code: normalizedCode,
        credits_awarded: creditsToAward,
        previous_balance: currentCredits,
      },
    })

    console.log(`✅ Code "${normalizedCode}" redeemed by ${userId}: +${creditsToAward} credits (${currentCredits} → ${newCredits})`)

    return NextResponse.json({
      success: true,
      credits: newCredits,
      awarded: creditsToAward,
      code: normalizedCode,
      message: `+${creditsToAward} credits unlocked!`,
    })

  } catch (error) {
    console.error('Award credits error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

