import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: NextRequest) {
  try {
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

    // Normalize code
    const normalizedCode = code.toUpperCase().trim()

    // Check if code is valid
    const validCodes: { [key: string]: number } = {
      'PORSCHE': 100,
      'FREE THE MUSIC': 10,
      // Add more codes here in the future
    }

    if (!validCodes[normalizedCode]) {
      return NextResponse.json(
        { success: false, error: 'Invalid authentication code' },
        { status: 400 }
      )
    }

    // Check if user already redeemed this code in the database
    const { data: existingRedemption, error: checkError } = await supabase
      .from('code_redemptions')
      .select('*')
      .eq('clerk_user_id', userId)
      .eq('code', normalizedCode)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is fine
      console.error('Error checking redemption:', checkError)
      return NextResponse.json(
        { success: false, error: 'Failed to verify code status' },
        { status: 500 }
      )
    }

    if (existingRedemption) {
      // Check if redemption is still within the one-month window
      const redemptionDate = new Date(existingRedemption.redeemed_at)
      const oneMonthAgo = new Date()
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

      if (redemptionDate > oneMonthAgo) {
        // Code was already redeemed within the last month
        return NextResponse.json(
          { success: false, error: 'Code already redeemed. Each code can only be used once per month.' },
          { status: 400 }
        )
      } else {
        // More than a month has passed, update the redemption date
        const { error: updateRedemptionError } = await supabase
          .from('code_redemptions')
          .update({ 
            redeemed_at: new Date().toISOString(),
            redemption_count: existingRedemption.redemption_count + 1
          })
          .eq('id', existingRedemption.id)

        if (updateRedemptionError) {
          console.error('Error updating redemption:', updateRedemptionError)
        }
      }
    } else {
      // First time redeeming this code, create a new redemption record
      const { error: insertError } = await supabase
        .from('code_redemptions')
        .insert({
          clerk_user_id: userId,
          code: normalizedCode,
          credits_awarded: validCodes[normalizedCode],
          redeemed_at: new Date().toISOString(),
          redemption_count: 1
        })

      if (insertError) {
        console.error('Error recording redemption:', insertError)
        // Continue anyway to award credits
      }
    }

    const creditsToAward = validCodes[normalizedCode]

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

    // Update credits
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        credits: newCredits,
        updated_at: new Date().toISOString()
      })
      .eq('clerk_user_id', userId)

    if (updateError) {
      console.error('Error updating credits:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update credits' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      credits: newCredits,
      awarded: creditsToAward,
      code: normalizedCode,
      message: 'Credits awarded! This code can be redeemed again in one month.'
    })

  } catch (error) {
    console.error('Award credits error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

