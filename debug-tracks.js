const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTracks() {
  console.log('\n=== NEWEST 10 TRACKS ===');
  const { data: newTracks, error: error1 } = await supabase
    .from('combined_media')
    .select('id, title, plays, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error1) {
    console.error('Error fetching new tracks:', error1);
  } else {
    newTracks.forEach(t => {
      const date = new Date(t.created_at).toISOString().split('T')[0];
      console.log(`${date} | plays: ${t.plays || 0} | ${t.title} | user: ${t.user_id?.substring(0,20) || 'NULL'}`);
    });
  }

  console.log('\n=== OLDEST 10 TRACKS WITH PLAYS > 0 ===');
  const { data: oldTracks, error: error2 } = await supabase
    .from('combined_media')
    .select('id, title, plays, created_at, user_id')
    .gt('plays', 0)
    .order('created_at', { ascending: true })
    .limit(10);
  
  if (error2) {
    console.error('Error fetching old tracks:', error2);
  } else {
    oldTracks.forEach(t => {
      const date = new Date(t.created_at).toISOString().split('T')[0];
      console.log(`${date} | plays: ${t.plays} | ${t.title} | user: ${t.user_id?.substring(0,20) || 'NULL'}`);
    });
  }

  console.log('\n=== SUMMARY: OLD vs NEW ===');
  const { data: summary, error: error3 } = await supabase
    .rpc('get_tracks_summary');
  
  if (error3) {
    // If RPC doesn't exist, calculate manually
    const { data: allTracks } = await supabase
      .from('combined_media')
      .select('created_at, plays');
    
    const oldCutoff = new Date('2026-01-24');
    const old = allTracks.filter(t => new Date(t.created_at) < oldCutoff);
    const newt = allTracks.filter(t => new Date(t.created_at) >= oldCutoff);
    
    console.log(`OLD tracks (before Jan 24): ${old.length} total, ${old.filter(t => (t.plays || 0) > 0).length} with plays, ${old.reduce((sum, t) => sum + (t.plays || 0), 0)} total plays`);
    console.log(`NEW tracks (after Jan 24): ${newt.length} total, ${newt.filter(t => (t.plays || 0) > 0).length} with plays, ${newt.reduce((sum, t) => sum + (t.plays || 0), 0)} total plays`);
  } else {
    console.log(summary);
  }
}

debugTracks().catch(console.error);
