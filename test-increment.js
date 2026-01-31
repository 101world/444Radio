const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://yirjulakkgignzbrqnth.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpcmp1bGFra2dpZ256YnJxbnRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTkxOTk2MSwiZXhwIjoyMDc1NDk1OTYxfQ.Do8wKOZd1fswfo32D3Vi7kfN4EVKIXnMQ6iUehnA8oM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testIncrement() {
  console.log('Testing increment_play_count function...');
  
  // First, check current play count
  const trackId = 'a4a919d0-3d0d-4de4-8372-7238abef8a87'; // Groove track
  
  const { data: before, error: error1 } = await supabase
    .from('combined_media')
    .select('id, title, plays')
    .eq('id', trackId)
    .single();
  
  if (error1) {
    console.error('Error fetching track:', error1);
    return;
  }
  
  console.log(`BEFORE: ${before.title} - plays: ${before.plays}`);
  
  // Try to increment
  const { data: newCount, error: error2 } = await supabase
    .rpc('increment_play_count', { media_id: trackId });
  
  if (error2) {
    console.error('Error incrementing:', error2);
    console.log('\n⚠️ FUNCTION NEEDS SECURITY DEFINER! Use Supabase SQL Editor to run:');
    console.log('\n' + fs.readFileSync('db/migrations/111_hotfix_increment_security_definer.sql', 'utf8'));
  } else {
    console.log(`✅ SUCCESS! New play count: ${newCount}`);
    
    // Verify
    const { data: after } = await supabase
      .from('combined_media')
      .select('plays')
      .eq('id', trackId)
      .single();
    
    console.log(`AFTER: ${after.plays}`);
  }
}

testIncrement().catch(console.error);
