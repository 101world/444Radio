require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Finding visualizer entries...\n');
  
  // Find entries with this visualizer
  const { data, error } = await supabase
    .from('combined_media')
    .select('id, user_id, title, type, genre, audio_url, video_url, media_url, created_at')
    .or('video_url.like.%visualizer-user_34IkVS04YVAZH371HSr3aaZlU60-1771597879828.mp4%,audio_url.like.%visualizer-user_34IkVS04YVAZH371HSr3aaZlU60-1771597879828.mp4%,media_url.like.%visualizer-user_34IkVS04YVAZH371HSr3aaZlU60-1771597879828.mp4%')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`Found ${data.length} entries with this visualizer:\n`);
  data.forEach((entry, i) => {
    console.log(`${i + 1}. ID: ${entry.id}`);
    console.log(`   Title: ${entry.title}`);
    console.log(`   Type: ${entry.type}, Genre: ${entry.genre}`);
    console.log(`   Audio URL: ${entry.audio_url?.substring(0, 80)}...`);
    console.log(`   Video URL: ${entry.video_url?.substring(0, 80)}...`);
    console.log(`   Media URL: ${entry.media_url?.substring(0, 80)}...`);
    console.log(`   Created: ${entry.created_at}`);
    console.log('   --- Should this be deleted? ---');
    // Individual visualizer = type:'video' + genre:'visualizer' + title starts with 'Visualizer:'
    const isIndividual = entry.type === 'video' && 
                          entry.genre === 'visualizer' && 
                          entry.title?.startsWith('Visualizer:');
    console.log(`   ${isIndividual ? '❌ YES - This is an individual visualizer release' : '✅ NO - This is a combined release'}`);
    console.log('');
  });
 
  // Also check recent releases from this user
  console.log('\n📋 Recent releases from this user:\n');
  const { data: userReleases } = await supabase
    .from('combined_media')
    .select('id, title, type, genre, created_at')
    .eq('user_id', 'user_34IkVS04YVAZH371HSr3aaZlU60')
    .order('created_at', { ascending: false })
    .limit(5);
    
  userReleases?.forEach((r, i) => {
    console.log(`${i + 1}. ${r.title} (type: ${r.type}, genre: ${r.genre}) - ${r.created_at}`);
  });
})();
