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

    // Get membership to get credits paid
    const { data: membership, error: memberError } = await supabase
      .from('private_list_members')
      .select('*')
      .eq('list_id', listId)
      .eq('user_id', userId)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'Not a member of this list' }, { status: 404 })
    }

    // Refund credits
    if (membership.credits_paid > 0) {
      const { data: creditsData } = await supabase
        .from('users')
        .select('credits')
        .eq('clerk_user_id', userId)
        .single()

      const currentCredits = creditsData?.credits || 0

      const { error: creditsError } = await supabase
        .from('users')
        .update({ credits: currentCredits + membership.credits_paid })
        .eq('clerk_user_id', userId)

      if (creditsError) {
        console.error('Error refunding credits:', creditsError)
      }
    }

    // Remove from list
    const { error: deleteError } = await supabase
      .from('private_list_members')
      .delete()
      .eq('list_id', listId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error leaving list:', deleteError)
      return NextResponse.json({ error: 'Failed to leave list' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/private-lists/leave:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
