#!/usr/bin/env node
/**
 * Run database migrations directly against Supabase
 * Uses NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from env
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'db', 'migrations')
  
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found')
    return
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  console.log(`Found ${files.length} migration(s)`)

  for (const file of files) {
    const filePath = path.join(migrationsDir, file)
    const sql = fs.readFileSync(filePath, 'utf-8')
    
    console.log(`\nRunning: ${file}`)
    
    try {
      // Execute raw SQL via Supabase RPC or direct query
      // Note: Supabase doesn't have direct raw SQL execution in JS client
      // This will attempt to parse and execute via RPC
      const { error } = await supabase.rpc('exec_sql', { sql_string: sql })
      
      if (error) {
        console.error(`❌ Error in ${file}:`, error.message)
        // Continue with other migrations
      } else {
        console.log(`✅ ${file}`)
      }
    } catch (err) {
      console.error(`❌ Failed to execute ${file}:`, err.message)
    }
  }

  console.log('\n✅ Migrations complete')
}

runMigrations().catch(console.error)
