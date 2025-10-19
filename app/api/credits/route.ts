import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const response = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,total_generated`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch user data')
    }

    const data = await response.json()
    const user = data?.[0]

    return NextResponse.json({ 
      credits: user?.credits || 0,
      totalGenerated: user?.total_generated || 0
    })
  } catch (error) {
    console.error('Error fetching credits:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch credits',
      credits: 0,
      totalGenerated: 0
    }, { status: 500 })
  }
}
