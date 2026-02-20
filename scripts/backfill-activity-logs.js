#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs')
const path = require('path')

async function run() {
  const pgConnection = process.env.PG_CONNECTION_STRING || process.env.DATABASE_URL
  if (!pgConnection) {
    console.error('❌ No PG_CONNECTION_STRING or DATABASE_URL found.')
    process.exit(1)
  }

  console.log('🔄 Backfilling activity_logs with historical data...')

  // Lazy import pg
  const { Client } = require('pg')
  const client = new Client({ connectionString: pgConnection })

  try {
    await client.connect()
    console.log('✅ Connected to database')
    
    const backfillScript = path.join(__dirname, '..', 'db', 'migrations', 'BACKFILL_ACTIVITY_LOGS.sql')
    const sql = fs.readFileSync(backfillScript, 'utf8')
    
    console.log('📝 Running backfill script...')
    await client.query(sql)
    
    console.log('✅ Backfill completed successfully!')
    await client.end()
  } catch (err) {
    console.error('❌ Backfill failed:', err.message)
    try { await client.end() } catch(e){}
    process.exit(1)
  }
}

run()
