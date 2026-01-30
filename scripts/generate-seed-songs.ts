/**
 * Script to generate songs from seed data
 * Usage: npx tsx scripts/generate-seed-songs.ts
 * 
 * This script will:
 * 1. Read the seed-songs.json file
 * 2. Generate each song using your music generation API
 * 3. Track progress and handle errors
 */

import fs from 'fs'
import path from 'path'

interface SeedSong {
  title: string
  genre: string
  lyrics: string
}

async function generateSong(song: SeedSong, apiUrl: string, userId: string) {
  try {
    console.log(`🎵 Generating: ${song.title} (${song.genre})...`)
    
    // Use the music-only endpoint which doesn't require a song record
    const response = await fetch(`${apiUrl}/api/generate/music-only`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`, // Add auth if needed
      },
      body: JSON.stringify({
        title: song.title,  // REQUIRED: 3-100 characters
        prompt: song.lyrics, // REQUIRED: 10-300 characters  
        lyrics: song.lyrics,
        genre: song.genre,
        duration: 'medium',
        language: 'English',
        generateCoverArt: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    console.log(`✅ Generated: ${song.title}`)
    return { success: true, song: song.title, data }
  } catch (error) {
    console.error(`❌ Failed: ${song.title}`, error)
    return { success: false, song: song.title, error }
  }
}

async function main() {
  // Configuration
  const API_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const USER_ID = process.env.SEED_USER_ID || 'your-user-id-here'
  
  console.log('🎼 444Radio Seed Song Generator')
  console.log('================================')
  console.log(`API URL: ${API_URL}`)
  console.log(`User ID: ${USER_ID}\n`)

  // Read seed songs
  const seedPath = path.join(process.cwd(), 'scripts', 'seed-songs.json')
  const songs: SeedSong[] = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))
  
  console.log(`📋 Found ${songs.length} songs to generate\n`)

  // Generate songs with delay to avoid rate limiting
  const results = []
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i]
    console.log(`[${i + 1}/${songs.length}] Processing: ${song.title}`)
    
    const result = await generateSong(song, API_URL, USER_ID)
    results.push(result)
    
    // Wait 2 seconds between requests to avoid rate limiting
    if (i < songs.length - 1) {
      console.log('⏳ Waiting 2 seconds...\n')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  // Summary
  console.log('\n================================')
  console.log('📊 Generation Summary')
  console.log('================================')
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  console.log(`✅ Successful: ${successful}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📝 Total: ${songs.length}`)
  
  // Save results
  const resultsPath = path.join(process.cwd(), 'scripts', 'seed-results.json')
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2))
  console.log(`\n💾 Results saved to: ${resultsPath}`)
}

main().catch(console.error)
