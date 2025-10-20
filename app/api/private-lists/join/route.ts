import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { listId } = await req.json()

    if (!listId) {
      return NextResponse.json({ error: 'List ID required' }, { status: 400 })
    }

    // Get list details
    const { data: list, error: listError } = await supabase
      .from('private_lists')
      .select('*')
      .eq('id', listId)
      .single()

    if (listError || !list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('private_list_members')
      .select('id')
      .eq('list_id', listId)
      .eq('user_id', userId)
      .single()

    if (existingMember) {
      return NextResponse.json({ error: 'Already a member' }, { status: 400 })
    }

    // Check capacity
    const { count } = await supabase
      .from('private_list_members')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId)

    if (count && count >= list.max_capacity) {
      return NextResponse.json({ error: 'List is full' }, { status: 400 })
    }

    // Check user credits
    const { data: creditsData } = await supabase
      .from('credits')
      .select('credits')
      .eq('user_id', userId)
      .single()

    const userCredits = creditsData?.credits || 0

    if (userCredits < list.price_credits) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 })
    }

    // Deduct credits
    if (list.price_credits > 0) {
      const { error: creditsError } = await supabase
        .from('credits')
        .update({ credits: userCredits - list.price_credits })
        .eq('user_id', userId)

      if (creditsError) {
        console.error('Error deducting credits:', creditsError)
        return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 })
      }
    }

    // Add to list
    const { data: membership, error: memberError } = await supabase
      .from('private_list_members')
      .insert([{
        list_id: listId,
        user_id: userId,
        credits_paid: list.price_credits
      }])
      .select()
      .single()

    if (memberError) {
      console.error('Error joining list:', memberError)
      // Refund credits if join failed
      if (list.price_credits > 0) {
        await supabase
          .from('credits')
          .update({ credits: userCredits })
          .eq('user_id', userId)
      }
      return NextResponse.json({ error: 'Failed to join list' }, { status: 500 })
    }

    return NextResponse.json({ success: true, membership })
  } catch (error) {
    console.error('Error in POST /api/private-lists/join:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
