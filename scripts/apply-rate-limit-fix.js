// Temporary script to apply rate limit migration via Supabase REST API
// This replaces the validate_plugin_token function to raise the limit from 100 to 2000

const https = require('https');

const SUPABASE_URL = 'https://yirjulakkgignzbrqnth.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpcmp1bGFra2dpZ256YnJxbnRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTkxOTk2MSwiZXhwIjoyMDc1NDk1OTYxfQ.Do8wKOZd1fswfo32D3Vi7kfN4EVKIXnMQ6iUehnA8oM';

const sql = `
CREATE OR REPLACE FUNCTION validate_plugin_token(p_token TEXT)
RETURNS TABLE (user_id TEXT, token_id UUID, is_valid BOOLEAN, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_token_record RECORD;
BEGIN
  SELECT pt.id, pt.clerk_user_id, pt.is_active, pt.expires_at,
         pt.requests_today, pt.requests_reset_at
  INTO v_token_record
  FROM plugin_tokens pt
  WHERE pt.token = p_token AND pt.is_active = true;
  
  IF v_token_record IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::UUID, false, 'Invalid or revoked token'::TEXT;
    RETURN;
  END IF;
  
  IF v_token_record.expires_at IS NOT NULL AND v_token_record.expires_at < NOW() THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::UUID, false, 'Token expired'::TEXT;
    RETURN;
  END IF;
  
  IF v_token_record.requests_reset_at < NOW() - INTERVAL '24 hours' THEN
    UPDATE plugin_tokens SET requests_today = 1, requests_reset_at = NOW() WHERE id = v_token_record.id;
  ELSIF v_token_record.requests_today >= 2000 THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::UUID, false, 'Daily rate limit exceeded (2000/day)'::TEXT;
    RETURN;
  ELSE
    UPDATE plugin_tokens SET requests_today = requests_today + 1 WHERE id = v_token_record.id;
  END IF;
  
  UPDATE plugin_tokens SET last_used_at = NOW() WHERE id = v_token_record.id;
  
  RETURN QUERY SELECT v_token_record.clerk_user_id, v_token_record.id, true, NULL::TEXT;
END;
$fn$;
`;

// Use the Supabase pg_net or direct SQL approach
// Since we can't run raw SQL via REST, we'll use the supabase-js client  
// to call an RPC that doesn't exist. Instead, let's try the management API.

// Actually, let's just use the pg module directly with the pooler connection
const { Client } = require('pg');

async function run() {
  // Supabase direct connection (session mode)
  const client = new Client({
    host: 'db.yirjulakkgignzbrqnth.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres.yirjulakkgignzbrqnth',
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL');
    
    await client.query(sql);
    console.log('✅ validate_plugin_token function updated (rate limit: 2000/day)');
    
    // Also reset any currently rate-limited tokens
    const res = await client.query('UPDATE plugin_tokens SET requests_today = 0, requests_reset_at = NOW() WHERE requests_today >= 100 RETURNING id, clerk_user_id');
    console.log(`✅ Reset ${res.rowCount} rate-limited tokens`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
