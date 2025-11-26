#!/usr/bin/env node
/**
 * Clean Expired Replicate URLs from Database
 * 
 * Replicate URLs expire after 24-48 hours. This script:
 * 1. Finds all records with temporary Replicate URLs
 * 2. Marks them as expired or removes them
 * 3. Prevents errors for users trying to access old content
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanExpiredUrls() {
  console.log('🧹 Starting cleanup of expired Replicate URLs...\n')

  try {
    // Tables to clean
    const tables = [
      'combined_media',
      'music_library',
      'images_library',
      'songs'
    ]

    let totalCleaned = 0

    for (const table of tables) {
      console.log(`\n📋 Checking ${table}...`)

      // Find records with Replicate URLs (they contain 'replicate.delivery')
      const audioQuery = supabase
        .from(table)
        .select('id, audio_url, created_at')
        .like('audio_url', '%replicate.delivery%')

      const imageQuery = supabase
        .from(table)
        .select('id, image_url, created_at')
        .like('image_url', '%replicate.delivery%')

      const coverQuery = supabase
        .from(table)
        .select('id, cover_url, created_at')
        .like('cover_url', '%replicate.delivery%')

      const [audioResult, imageResult, coverResult] = await Promise.all([
        audioQuery,
        imageQuery,
        coverQuery
      ])

      const audioRecords = audioResult.data || []
      const imageRecords = imageResult.data || []
      const coverRecords = coverResult.data || []

      console.log(`  Found ${audioRecords.length} audio Replicate URLs`)
      console.log(`  Found ${imageRecords.length} image Replicate URLs`)
      console.log(`  Found ${coverRecords.length} cover Replicate URLs`)

      // Delete records with expired Replicate URLs
      const idsToDelete = new Set([
        ...audioRecords.map(r => r.id),
        ...imageRecords.map(r => r.id),
        ...coverRecords.map(r => r.id)
      ])

      if (idsToDelete.size > 0) {
        console.log(`  🗑️  Deleting ${idsToDelete.size} expired records...`)
        
        const { error } = await supabase
          .from(table)
          .delete()
          .in('id', Array.from(idsToDelete))

        if (error) {
          console.error(`  ❌ Error deleting from ${table}:`, error.message)
        } else {
          console.log(`  ✅ Deleted ${idsToDelete.size} expired records from ${table}`)
          totalCleaned += idsToDelete.size
        }
      } else {
        console.log(`  ✅ No expired URLs found in ${table}`)
      }
    }

    console.log(`\n✅ Cleanup complete! Removed ${totalCleaned} expired records.`)
    console.log('\n💡 All new generations will now use permanent R2 URLs.')
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error)
    process.exit(1)
  }
}

// Run cleanup
cleanExpiredUrls()
