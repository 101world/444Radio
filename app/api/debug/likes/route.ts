import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * GET /api/debug/likes
 * Debug endpoint to check like system database schema
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Check if user_likes table exists
    const userLikesCheck = await fetch(
      `${supabaseUrl}/rest/v1/user_likes?limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const userLikesExists = userLikesCheck.status !== 404

    // Check if likes_count column exists in combined_media
    const mediaCheck = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?select=id,likes_count&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const likesCountExists = mediaCheck.status !== 400

    // Get sample data
    let sampleLikes = []
    let sampleMedia = []

    if (userLikesExists) {
      const likesRes = await fetch(
        `${supabaseUrl}/rest/v1/user_likes?limit=5`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      )
      sampleLikes = await likesRes.json()
    }

    if (likesCountExists) {
      const mediaRes = await fetch(
        `${supabaseUrl}/rest/v1/combined_media?select=id,title,likes_count&limit=5`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      )
      sampleMedia = await mediaRes.json()
    }

    return NextResponse.json({
      success: true,
      schema: {
        user_likes_table_exists: userLikesExists,
        likes_count_column_exists: likesCountExists
      },
      samples: {
        user_likes: sampleLikes,
        combined_media: sampleMedia
      },
      migration_status: userLikesExists && likesCountExists 
        ? '✅ Migration deployed successfully' 
        : '❌ Migration NOT deployed - run migrations',
      instructions: userLikesExists && likesCountExists 
        ? 'Schema is ready. Like buttons should work.'
        : 'Run: npm run migrate OR manually run db/migrations/005_add_likes_system.sql'
    })

  } catch (error) {
    console.error('Debug likes error:', error)
    return NextResponse.json({
      error: 'Failed to check like system',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
