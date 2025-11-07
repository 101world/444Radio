// Quick script to add lyrics column to combined_media via Supabase SQL API
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// SQL to add lyrics column
const sql = `
-- Add lyrics column to combined_media table
ALTER TABLE public.combined_media 
ADD COLUMN IF NOT EXISTS lyrics TEXT;

-- Create index for lyrics search
CREATE INDEX IF NOT EXISTS idx_combined_media_lyrics 
ON public.combined_media USING gin(to_tsvector('english', lyrics));
`;

console.log('🔧 Adding lyrics column to combined_media table...');
console.log('📝 SQL:', sql);

// Supabase REST API endpoint for executing SQL
const url = new URL('/rest/v1/rpc/execute_sql', supabaseUrl);

const options = {
  method: 'POST',
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  }
};

const data = JSON.stringify({ query: sql });

const req = https.request(url, options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Migration successful!');
      console.log('Response:', body);
    } else {
      console.error('❌ Migration failed:', res.statusCode);
      console.error('Response:', body);
      console.log('\n💡 Run this SQL manually in Supabase SQL Editor:');
      console.log(sql);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error);
  console.log('\n💡 Run this SQL manually in Supabase SQL Editor:');
  console.log(sql);
});

req.write(data);
req.end();
