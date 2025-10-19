import { auth } from '@clerk/nextjs/server'
import { supabase } from '../../../lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('credits, total_generated')
      .eq('clerk_user_id', userId)
      .single()

    if (error) throw error

    return NextResponse.json({ 
      credits: data?.credits || 0,
      totalGenerated: data?.total_generated || 0
    })
  } catch (error) {
    console.error('Error fetching credits:', error)
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 })
  }
}
