const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yirjulakkgignzbrqnth.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpcmp1bGFra2dpZ256YnJxbnRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTkxOTk2MSwiZXhwIjoyMDc1NDk1OTYxfQ.Do8wKOZd1fswfo32D3Vi7kfN4EVKIXnMQ6iUehnA8oM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFunction() {
  // Check function definition via raw query  
  const { data, error } = await supabase
    .rpc('query', {
      query_text: `
        SELECT 
          proname as function_name,
          prosecdef as is_security_definer,
          pg_get_functiondef(oid) as full_definition
        FROM pg_proc
        WHERE proname = 'increment_play_count';
      `
    });
  
  if (error) {
    console.log('Using direct query instead...');
    // Alternative: check if we can call it successfully
    const { data: test, error: testError } = await supabase
      .rpc('increment_play_count', { media_id: 'a4a919d0-3d0d-4de4-8372-7238abef8a87' });
    
    if (testError) {
      console.error('❌ Function call failed:', testError.message);
      console.log('\nFunction is NOT working. Needs SECURITY DEFINER.');
    } else {
      console.log('✅ Function call succeeded! New count:', test);
      console.log('\nFunction IS working (has SECURITY DEFINER).');
    }
  } else {
    console.log('Function details:', data);
  }
}

checkFunction().catch(console.error);
