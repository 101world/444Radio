// Check lyrics status across all tables
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkLyricsStatus() {
  console.log('🔍 Detailed Lyrics Status Check\n');

  // Check combined_media
  console.log('📊 COMBINED_MEDIA (Public Explore/Profile)');
  const { data: cm, error: cmError } = await supabase
    .from('combined_media')
    .select('id, title, audio_url, lyrics')
    .limit(5);

  if (cmError) {
    console.log('❌ Error:', cmError.message);
  } else {
    console.log(`   Total sampled: ${cm.length}`);
    console.log(`   With lyrics: ${cm.filter(t => t.lyrics).length}`);
    console.log(`   Without lyrics: ${cm.filter(t => !t.lyrics).length}\n`);
    
    if (cm.length > 0) {
      console.log('   Sample tracks:');
      cm.forEach((track, i) => {
        console.log(`   ${i + 1}. "${track.title}"`);
        console.log(`      Lyrics: ${track.lyrics ? '✅ Yes (' + track.lyrics.substring(0, 30) + '...)' : '❌ None'}`);
        console.log(`      URL: ${track.audio_url.substring(0, 60)}...`);
      });
    }
  }

  // Check combined_media_library
  console.log('\n📊 COMBINED_MEDIA_LIBRARY (User Library)');
  const { data: cml, error: cmlError } = await supabase
    .from('combined_media_library')
    .select('id, title, audio_url, lyrics, music_id')
    .limit(5);

  if (cmlError) {
    console.log('❌ Error:', cmlError.message);
  } else {
    console.log(`   Total sampled: ${cml.length}`);
    console.log(`   With lyrics: ${cml.filter(t => t.lyrics).length}`);
    console.log(`   Without lyrics: ${cml.filter(t => !t.lyrics).length}\n`);
    
    if (cml.length > 0) {
      console.log('   Sample tracks:');
      cml.forEach((track, i) => {
        console.log(`   ${i + 1}. "${track.title}"`);
        console.log(`      Lyrics: ${track.lyrics ? '✅ Yes (' + track.lyrics.substring(0, 30) + '...)' : '❌ None'}`);
        console.log(`      URL: ${track.audio_url.substring(0, 60)}...`);
        console.log(`      music_id: ${track.music_id || 'NULL'}`);
      });
    }
  }

  // Check music_library
  console.log('\n📊 MUSIC_LIBRARY (Generated Music)');
  const { data: ml, error: mlError } = await supabase
    .from('music_library')
    .select('id, title, audio_url, lyrics')
    .limit(5);

  if (mlError) {
    console.log('❌ Error:', mlError.message);
  } else {
    console.log(`   Total sampled: ${ml.length}`);
    console.log(`   With lyrics: ${ml.filter(t => t.lyrics).length}`);
    console.log(`   Without lyrics: ${ml.filter(t => !t.lyrics).length}\n`);
    
    if (ml.length > 0) {
      console.log('   Sample tracks:');
      ml.forEach((track, i) => {
        console.log(`   ${i + 1}. "${track.title}"`);
        console.log(`      Lyrics: ${track.lyrics ? '✅ Yes (' + track.lyrics.substring(0, 30) + '...)' : '❌ None'}`);
      });
    }
  }

  console.log('\n💡 NEXT STEPS:');
  console.log('   1. If combined_media has no lyrics, the backfill SQL may need adjustment');
  console.log('   2. Check if audio_url matches between tables');
  console.log('   3. New generations should automatically include lyrics ✅');
}

checkLyricsStatus().catch(console.error);
