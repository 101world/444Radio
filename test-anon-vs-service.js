const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yirjulakkgignzbrqnth.supabase.co';

// Test with ANON key (like the API does)
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpcmp1bGFra2dpZ256YnJxbnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTk5NjEsImV4cCI6MjA3NTQ5NTk2MX0.Z1Tk2rMLWd29UovuIxa85G3MBP4avpRScr1dWNUvnCs';
const supabaseAnon = createClient(supabaseUrl, anonKey);

// Test with SERVICE ROLE key
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpcmp1bGFra2dpZ256YnJxbnRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTkxOTk2MSwiZXhwIjoyMDc1NDk1OTYxfQ.Do8wKOZd1fswfo32D3Vi7kfN4EVKIXnMQ6iUehnA8oM';
const supabaseService = createClient(supabaseUrl, serviceKey);

async function testBothKeys() {
  const trackId = '3c29a037-0c64-44dc-bc7b-8fe4c0ee2a5d'; // Saffron track
  
  console.log('=== TEST 1: ANON KEY (like API does) ===');
  const { data: anonData, error: anonError } = await supabaseAnon
    .rpc('increment_play_count', { media_id: trackId });
  
  if (anonError) {
    console.error('❌ ANON KEY FAILED:', anonError.message);
    console.error('Details:', anonError);
  } else {
    console.log('✅ ANON KEY SUCCESS! New count:', anonData);
  }
  
  console.log('\n=== TEST 2: SERVICE ROLE KEY ===');
  const { data: serviceData, error: serviceError } = await supabaseService
    .rpc('increment_play_count', { media_id: trackId });
  
  if (serviceError) {
    console.error('❌ SERVICE ROLE FAILED:', serviceError.message);
  } else {
    console.log('✅ SERVICE ROLE SUCCESS! New count:', serviceData);
  }
  
  // Check current count
  const { data: current } = await supabaseService
    .from('combined_media')
    .select('title, plays')
    .eq('id', trackId)
    .single();
  
  console.log('\nCurrent track status:', current);
}

testBothKeys().catch(console.error);
