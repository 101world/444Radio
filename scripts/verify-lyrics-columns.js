// Verify lyrics columns exist in Supabase tables
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyLyricsColumns() {
  console.log('🔍 Verifying lyrics columns...\n');

  // Test combined_media
  console.log('1️⃣ Checking combined_media.lyrics...');
  const { data: data1, error: error1 } = await supabase
    .from('combined_media')
    .select('id, title, lyrics')
    .limit(1);

  if (error1) {
    console.log('❌ combined_media.lyrics NOT found');
    console.log('   Error:', error1.message);
  } else {
    console.log('✅ combined_media.lyrics column exists!');
    if (data1 && data1.length > 0) {
      console.log('   Sample:', data1[0].title, '| Lyrics:', data1[0].lyrics ? 'Has lyrics' : 'No lyrics yet');
    }
  }

  // Test combined_media_library
  console.log('\n2️⃣ Checking combined_media_library.lyrics...');
  const { data: data2, error: error2 } = await supabase
    .from('combined_media_library')
    .select('id, title, lyrics')
    .limit(1);

  if (error2) {
    console.log('❌ combined_media_library.lyrics NOT found');
    console.log('   Error:', error2.message);
  } else {
    console.log('✅ combined_media_library.lyrics column exists!');
    if (data2 && data2.length > 0) {
      console.log('   Sample:', data2[0].title, '| Lyrics:', data2[0].lyrics ? 'Has lyrics' : 'No lyrics yet');
    }
  }

  console.log('\n🎉 Verification complete!');
}

verifyLyricsColumns().catch(console.error);
