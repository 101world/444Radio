import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { logCreditTransaction } from '@/lib/credit-transactions'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// ──────────────────────────────────────────────────────
// Hardcoded credit codes — per-code claim policies
//   'lifetime'  = one claim ever, permanently blocked after
//   'unlimited' = claim as many times as you want
//   'monthly'   = one claim per calendar month
// ──────────────────────────────────────────────────────
type ClaimPolicy = 'lifetime' | 'unlimited' | 'monthly'

interface CodeConfig {
  credits: number
  description: string
  policy: ClaimPolicy
}

const VALID_CODES: Record<string, CodeConfig> = {
  'FREE THE MUSIC': { credits: 20,  description: 'Decrypt puzzle — 20 credits',  policy: 'lifetime'  },
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

    // ── Check existing redemptions for this user + code ──
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

    const policy = codeConfig.policy

    // ── Enforce claim policy ──
    if (existingRedemption) {
      if (policy === 'lifetime') {
        // Permanently blocked — one claim ever
        console.log(`⛔ Code "${normalizedCode}" already claimed (lifetime) by ${userId}`)
        return NextResponse.json(
          {
            success: false,
            error: 'This code has already been claimed. Each code can only be used once per account — ever.',
            alreadyClaimed: true,
          },
          { status: 400 }
        )
      }

      if (policy === 'monthly') {
        // Blocked if last claim was within the current calendar month
        const lastClaim = new Date(existingRedemption.redeemed_at)
        const now = new Date()
        const sameMonth = lastClaim.getUTCFullYear() === now.getUTCFullYear()
                       && lastClaim.getUTCMonth() === now.getUTCMonth()
        if (sameMonth) {
          console.log(`⛔ Code "${normalizedCode}" already claimed this month by ${userId}`)
          return NextResponse.json(
            {
              success: false,
              error: 'This code can only be claimed once per month. Try again next month!',
              alreadyClaimed: true,
            },
            { status: 400 }
          )
        }
      }

      // policy === 'unlimited' OR monthly cooldown passed → allow, update record
      await supabase
        .from('code_redemptions')
        .update({
          redeemed_at: new Date().toISOString(),
          redemption_count: (existingRedemption.redemption_count || 0) + 1,
        })
        .eq('id', existingRedemption.id)
    }

    // ── Award credits ──
    const creditsToAward = codeConfig.credits

    // ── Record redemption FIRST (before credits) — prevents race condition ──
    // If two requests race, the second INSERT fails on the unique index
    // and no credits are ever awarded twice.
    if (!existingRedemption) {
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
        // Unique constraint violation = another concurrent request already claimed
        if (insertError.code === '23505' || insertError.message?.includes('duplicate') || insertError.message?.includes('unique')) {
          console.log(`⛔ Race condition caught: Code "${normalizedCode}" already claimed by ${userId}`)
          return NextResponse.json(
            { success: false, error: 'This code has already been claimed.', alreadyClaimed: true },
            { status: 400 }
          )
        }
        console.error('Error recording redemption:', insertError)
        return NextResponse.json(
          { success: false, error: 'Failed to record code redemption' },
          { status: 500 }
        )
      }
    }

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

