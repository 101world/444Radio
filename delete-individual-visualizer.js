require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const targetId = 'ccf1f857-8e39-4a95-bf69-2fcf9fce70e7';
  
  console.log('🗑️  Deleting individual visualizer entry...\n');
  console.log('ID:', targetId);
  console.log('Title: Visualizer: Ultra-realistic warzone at golden hour, lone soldier walking');
  console.log('Type: video, Genre: visualizer\n');
  
  const { data, error } = await supabase
    .from('combined_media')
    .delete()
    .eq('id', targetId)
    .select();
  
  if (error) {
    console.error('❌ Error deleting:', error);
    return;
  }
  
  console.log('✅ Successfully deleted individual visualizer entry!');
  console.log('Deleted:', data);
  console.log('\n✨ The song "Crimson Thundercloud" with attached visualizer remains on Explore.');
})();
