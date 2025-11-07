import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This endpoint should be called daily by a cron service (Vercel Cron, GitHub Actions, etc.)
// Example: curl -X POST https://yourdomain.com/api/cron/daily-play-bonus -H "Authorization: Bearer YOUR_CRON_SECRET"

export async function POST(req: Request) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Initialize Supabase with service role key (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get today's date
    const today = new Date().toISOString().split('T')[0]

    // Fetch all PUBLISHED tracks from combined_media
    const { data: publishedTracks, error: fetchError } = await supabase
      .from('combined_media')
      .select('id')
      .eq('is_published', true)

    if (fetchError) {
      console.error('Error fetching published tracks:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch tracks' }, { status: 500 })
    }

    if (!publishedTracks || publishedTracks.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No published tracks to credit',
        credited: 0 
      })
    }

    let creditedCount = 0
    let skippedCount = 0
    let updatedCount = 0

    // Process each track
    for (const track of publishedTracks) {
      // Try to insert daily bonus record (will fail if already exists due to UNIQUE constraint)
      const { error: insertError } = await supabase
        .from('daily_play_bonus')
        .insert({
          media_id: track.id,
          credited_on: today
        })

      // If insert succeeded (no duplicate), increment play count
      if (!insertError) {
        // Increment plays in combined_media
        const { data: currentTrack } = await supabase
          .from('combined_media')
          .select('plays')
          .eq('id', track.id)
          .single()

        const currentPlays = currentTrack?.plays || 0
        
        const { error: updateError } = await supabase
          .from('combined_media')
          .update({ plays: currentPlays + 1 })
          .eq('id', track.id)

        if (!updateError) {
          creditedCount++
          updatedCount++
        } else {
          console.error(`Failed to update play count for ${track.id}:`, updateError)
        }
      } else if (insertError.code === '23505') {
        // Duplicate key - already credited today
        skippedCount++
      } else {
        // Other error
        console.error(`Error inserting bonus for ${track.id}:`, insertError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Daily play bonus processed',
      date: today,
      totalTracks: publishedTracks.length,
      credited: creditedCount,
      skipped: skippedCount,
      updated: updatedCount
    })

  } catch (error) {
    console.error('Daily bonus cron error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Allow GET for testing (with auth)
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    message: 'Daily play bonus cron endpoint',
    instructions: 'Send POST request with Authorization: Bearer <CRON_SECRET> header to trigger daily bonus',
    note: 'This should be called once per day (e.g., 12:05 AM UTC)'
  })
}
