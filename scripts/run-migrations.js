#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

async function run() {
  const pgConnection = process.env.PG_CONNECTION_STRING || process.env.DATABASE_URL
  if (!pgConnection) {
    console.log('No PG_CONNECTION_STRING or DATABASE_URL found. Skipping migrations.')
    process.exit(0)
  }

  // Lazy import pg
  const { Client } = require('pg')
  const client = new Client({ connectionString: pgConnection })

  try {
    await client.connect()
    const migrationsDir = path.join(__dirname, '..', 'db', 'migrations')
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
      console.log('Running migration:', file)
      await client.query(sql)
    }
    console.log('Migrations completed')
    await client.end()
  } catch (err) {
    console.error('Migration failed:', err)
    try { await client.end() } catch(e){}
    process.exit(1)
  }
}

run()
