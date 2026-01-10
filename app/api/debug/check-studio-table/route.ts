import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if studio_projects table exists
    const { data: tables, error: tablesError } = await supabase
      .from('studio_projects')
      .select('*')
      .limit(1)

    if (tablesError) {
      return NextResponse.json({
        exists: false,
        error: tablesError.message,
        suggestion: 'Run the 008_studio_projects.sql migration'
      })
    }

    // Get count of projects
    const { count, error: countError } = await supabase
      .from('studio_projects')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      exists: true,
      totalProjects: count || 0,
      userCanAccess: true
    })

  } catch (error) {
    console.error('Check failed:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
