const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yirjulakkgignzbrqnth.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpcmp1bGFra2dpZ256YnJxbnRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTkxOTk2MSwiZXhwIjoyMDc1NDk1OTYxfQ.Do8wKOZd1fswfo32D3Vi7kfN4EVKIXnMQ6iUehnA8oM';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testTrackPlayIncrement() {
  const testTrackId = 'a4a919d0-3d0d-4de4-8372-7238abef8a87'; // Groove track
  
  console.log('Testing play count increment with SERVICE ROLE KEY...\n');
  
  // Get current play count
  const { data: before, error: error1 } = await supabaseAdmin
    .from('combined_media')
    .select('id, title, plays')
    .eq('id', testTrackId)
    .single();
  
  if (error1) {
    console.error('❌ Error fetching track:', error1);
    return;
  }
  
  console.log(`BEFORE: "${before.title}" - plays: ${before.plays}`);
  
  // Call increment function (simulating what the API does)
  const { data: newCount, error: error2 } = await supabaseAdmin
    .rpc('increment_play_count', { media_id: testTrackId });
  
  if (error2) {
    console.error('❌ Error incrementing:', error2);
    return;
  }
  
  console.log(`✅ Increment function returned: ${newCount}`);
  
  // Verify the increment worked
  const { data: after, error: error3 } = await supabaseAdmin
    .from('combined_media')
    .select('plays')
    .eq('id', testTrackId)
    .single();
  
  if (error3) {
    console.error('❌ Error verifying:', error3);
    return;
  }
  
  console.log(`AFTER: "${before.title}" - plays: ${after.plays}`);
  
  if (after.plays === before.plays + 1) {
    console.log('\n✅✅✅ SUCCESS! Play count incremented correctly!');
    console.log(`Expected: ${before.plays + 1}, Got: ${after.plays}`);
  } else {
    console.log('\n❌ FAILED! Play count did not increment');
    console.log(`Expected: ${before.plays + 1}, Got: ${after.plays}`);
  }
}

testTrackPlayIncrement().catch(console.error);
