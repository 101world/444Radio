// Script to add lyrics column to combined_media tables using Supabase client
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addLyricsColumn() {
  console.log('🔧 Adding lyrics column to combined_media tables...\n');

  // Step 1: Add to combined_media
  console.log('1️⃣ Adding lyrics to combined_media...');
  const { data: data1, error: error1 } = await supabase.rpc('exec_sql', {
    query: 'ALTER TABLE public.combined_media ADD COLUMN IF NOT EXISTS lyrics TEXT;'
  });
  
  if (error1) {
    console.log('⚠️ Using fallback method for combined_media...');
    // Fallback: Try to insert a record to test if column exists
    const { error: testError } = await supabase
      .from('combined_media')
      .select('lyrics')
      .limit(1);
    
    if (testError) {
      console.error('❌ Error:', testError.message);
      console.log('\n📝 MANUAL ACTION REQUIRED:');
      console.log('Go to Supabase Dashboard → SQL Editor and run:\n');
      console.log('ALTER TABLE public.combined_media ADD COLUMN IF NOT EXISTS lyrics TEXT;');
      console.log('ALTER TABLE public.combined_media_library ADD COLUMN IF NOT EXISTS lyrics TEXT;\n');
    } else {
      console.log('✅ lyrics column already exists or successfully added to combined_media');
    }
  } else {
    console.log('✅ lyrics column added to combined_media');
  }

  // Step 2: Add to combined_media_library
  console.log('\n2️⃣ Adding lyrics to combined_media_library...');
  const { data: data2, error: error2 } = await supabase.rpc('exec_sql', {
    query: 'ALTER TABLE public.combined_media_library ADD COLUMN IF NOT EXISTS lyrics TEXT;'
  });
  
  if (error2) {
    console.log('⚠️ Using fallback method for combined_media_library...');
    const { error: testError } = await supabase
      .from('combined_media_library')
      .select('lyrics')
      .limit(1);
    
    if (testError) {
      console.error('❌ Error:', testError.message);
      console.log('\n📝 MANUAL ACTION REQUIRED:');
      console.log('Go to Supabase Dashboard → SQL Editor and run:\n');
      console.log('ALTER TABLE public.combined_media_library ADD COLUMN IF NOT EXISTS lyrics TEXT;\n');
    } else {
      console.log('✅ lyrics column already exists or successfully added to combined_media_library');
    }
  } else {
    console.log('✅ lyrics column added to combined_media_library');
  }

  // Step 3: Test if columns exist by querying
  console.log('\n3️⃣ Verifying columns...');
  
  const { data: testCombined, error: testCombinedError } = await supabase
    .from('combined_media')
    .select('id, title, lyrics')
    .limit(1);
  
  const { data: testLibrary, error: testLibraryError } = await supabase
    .from('combined_media_library')
    .select('id, title, lyrics')
    .limit(1);

  if (!testCombinedError) {
    console.log('✅ combined_media.lyrics column verified');
  } else {
    console.log('❌ combined_media.lyrics column NOT found:', testCombinedError.message);
  }

  if (!testLibraryError) {
    console.log('✅ combined_media_library.lyrics column verified');
  } else {
    console.log('❌ combined_media_library.lyrics column NOT found:', testLibraryError.message);
  }

  console.log('\n✨ Done! If you see ❌ errors above, run the SQL manually in Supabase Dashboard.');
  console.log('\n📋 SQL to run manually:');
  console.log('ALTER TABLE public.combined_media ADD COLUMN IF NOT EXISTS lyrics TEXT;');
  console.log('ALTER TABLE public.combined_media_library ADD COLUMN IF NOT EXISTS lyrics TEXT;');
}

addLyricsColumn().catch(console.error);
