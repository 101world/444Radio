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
  'FREE THE MUSIC': { credits: 44,  description: 'Free the Music — 44 free credits',  policy: 'lifetime'  },
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

    // ── Award FREE credits (no wallet gate) via RPC ──
    const { data: awardResult, error: awardError } = await supabase.rpc('award_free_credits', {
      p_clerk_user_id: userId,
      p_amount: creditsToAward,
      p_description: `Code claimed: ${normalizedCode} — +${creditsToAward} free credits`,
      p_metadata: {
        code: normalizedCode,
        credits_awarded: creditsToAward,
        source: 'code_claim',
        campaign: 'free_the_music',
      }
    })

    if (awardError || !awardResult || awardResult.length === 0) {
      console.error('Error awarding free credits:', awardError)
      return NextResponse.json(
        { success: false, error: 'Failed to award credits' },
        { status: 500 }
      )
    }

    const result = awardResult[0]
    if (!result.success) {
      console.error('Award credits failed:', result.error_message)
      return NextResponse.json(
        { success: false, error: result.error_message || 'Failed to award credits' },
        { status: 500 }
      )
    }

    // Get total credits for response
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('credits, free_credits')
      .eq('clerk_user_id', userId)
      .single()

    const totalCredits = (userData?.credits || 0) + (userData?.free_credits || 0)

    console.log(`✅ Code "${normalizedCode}" redeemed by ${userId}: +${creditsToAward} free credits (total: ${totalCredits})`)

    // ── Notify admin on milestone redemptions (every 10 codes) ──
    try {
      const { count } = await supabase
        .from('code_redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('code', normalizedCode)

      const redemptionCount = count || 0
      if (redemptionCount > 0 && redemptionCount % 10 === 0) {
        // Milestone reached - notify admin
        await supabase.rpc('notify_admin', {
          p_title: `🎵 ${normalizedCode} Milestone: ${redemptionCount} Redemptions`,
          p_message: `The "${normalizedCode}" code has been redeemed ${redemptionCount} times. Total credits distributed: ${redemptionCount * creditsToAward}. Keep vibing! 🎶`,
          p_category: 'milestone',
          p_metadata: {
            code: normalizedCode,
            total_redemptions: redemptionCount,
            total_credits_distributed: redemptionCount * creditsToAward,
            credits_per_redemption: creditsToAward,
            milestone: redemptionCount,
            latest_user_id: userId
          }
        })
      }
    } catch (err) {
      // Non-critical - don't fail the redemption
      console.warn('Failed to send admin notification:', err)
    }

    return NextResponse.json({
      success: true,
      credits: totalCredits,
      free_credits: userData?.free_credits || 0,
      awarded: creditsToAward,
      code: normalizedCode,
      message: `+${creditsToAward} free credits unlocked! Generate for free, no payment required.`,
    })

  } catch (error) {
    console.error('Award credits error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

