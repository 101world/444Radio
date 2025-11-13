/**
 * List all audio files in Cloudflare R2 bucket
 * Compares R2 files with database records to find orphaned files
 * 
 * Run: node scripts/list-r2-audio.js
 */

const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3')
const fs = require('fs')
const path = require('path')

// Load .env.local file
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim()
      process.env[key.trim()] = value
    }
  })
}

console.log('📝 R2 Config:', {
  endpoint: process.env.R2_ENDPOINT?.substring(0, 30) + '...',
  hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
  hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
  audioUrl: process.env.NEXT_PUBLIC_R2_AUDIO_URL
})

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
})

async function listR2AudioFiles() {
  console.log('\n🔍 Checking Cloudflare R2 audio-files bucket...\n')

  try {
    const command = new ListObjectsV2Command({
      Bucket: 'audio-files'
    })
    
    const response = await s3Client.send(command)
    const files = response.Contents || []
    
    console.log(`📦 Total files in R2 bucket: ${files.length}`)
    console.log(`📊 Database has: 14 unique songs (from SQL query)`)
    console.log(`❌ Missing/Orphaned: ${files.length - 14} files\n`)
    
    console.log('─'.repeat(80))
    console.log('ALL FILES IN R2 BUCKET:')
    console.log('─'.repeat(80))
    
    files.forEach((file, index) => {
      const publicUrl = `${process.env.NEXT_PUBLIC_R2_AUDIO_URL}/${file.Key}`
      const sizeKB = ((file.Size || 0) / 1024).toFixed(2)
      const date = file.LastModified?.toISOString().split('T')[0]
      
      console.log(`${index + 1}. ${file.Key}`)
      console.log(`   URL: ${publicUrl}`)
      console.log(`   Size: ${sizeKB} KB | Modified: ${date}\n`)
    })
    
    console.log('─'.repeat(80))
    console.log('\n💡 Next Steps:')
    console.log('1. Copy this list of R2 URLs')
    console.log('2. Run the SQL query below in Supabase to see which are missing from DB\n')
    
    // Generate SQL to check which URLs are in R2 but not in database
    console.log('-- SQL to find orphaned files:')
    console.log('WITH r2_files AS (')
    files.forEach((file, index) => {
      const publicUrl = `${process.env.NEXT_PUBLIC_R2_AUDIO_URL}/${file.Key}`
      const comma = index < files.length - 1 ? ',' : ''
      console.log(`  SELECT '${publicUrl}' as audio_url${comma}`)
    })
    console.log('),')
    console.log('db_files AS (')
    console.log(`  SELECT audio_url FROM combined_media WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND audio_url IS NOT NULL`)
    console.log(`  UNION`)
    console.log(`  SELECT audio_url FROM combined_media_library WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'`)
    console.log(`  UNION`)
    console.log(`  SELECT audio_url FROM music_library WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'`)
    console.log(')')
    console.log('SELECT r2.audio_url as orphaned_file')
    console.log('FROM r2_files r2')
    console.log('LEFT JOIN db_files db ON r2.audio_url = db.audio_url')
    console.log('WHERE db.audio_url IS NULL;')
    
  } catch (error) {
    console.error('❌ Error listing R2 files:', error.message)
    console.error('\nMake sure these env vars are set in .env.local:')
    console.error('- R2_ENDPOINT')
    console.error('- R2_ACCESS_KEY_ID')
    console.error('- R2_SECRET_ACCESS_KEY')
    console.error('- NEXT_PUBLIC_R2_AUDIO_URL')
  }
}

listR2AudioFiles()
