import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Track redeemed codes per user
const redeemedCodes = new Map<string, Set<string>>()

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
      // Add more codes here in the future
    }

    if (!validCodes[normalizedCode]) {
      return NextResponse.json(
        { success: false, error: 'Invalid authentication code' },
        { status: 400 }
      )
    }

    // Check if user already redeemed this code
    const userRedeemed = redeemedCodes.get(userId) || new Set()
    if (userRedeemed.has(normalizedCode)) {
      return NextResponse.json(
        { success: false, error: 'Code already redeemed' },
        { status: 400 }
      )
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

    // Mark code as redeemed
    userRedeemed.add(normalizedCode)
    redeemedCodes.set(userId, userRedeemed)

    return NextResponse.json({
      success: true,
      credits: newCredits,
      awarded: creditsToAward,
      code: normalizedCode
    })

  } catch (error) {
    console.error('Award credits error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

