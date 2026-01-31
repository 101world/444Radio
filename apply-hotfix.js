const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yirjulakkgignzbrqnth.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpcmp1bGFra2dpZ256YnJxbnRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTkxOTk2MSwiZXhwIjoyMDc1NDk1OTYxfQ.Do8wKOZd1fswfo32D3Vi7kfN4EVKIXnMQ6iUehnA8oM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyHotfix() {
  console.log('Applying SECURITY DEFINER hotfix to increment_play_count...');
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION increment_play_count(media_id UUID)
      RETURNS INTEGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        new_play_count INTEGER;
      BEGIN
        UPDATE combined_media
        SET plays = COALESCE(plays, 0) + 1
        WHERE id = media_id
        RETURNING plays INTO new_play_count;
        
        RETURN new_play_count;
      END;
      $$;
      
      GRANT EXECUTE ON FUNCTION increment_play_count(uuid) TO authenticated;
      GRANT EXECUTE ON FUNCTION increment_play_count(uuid) TO anon;
    `
  });
  
  if (error) {
    console.error('Error:', error);
    // Try direct query instead
    const queries = [
      `DROP FUNCTION IF EXISTS increment_play_count(uuid);`,
      `CREATE FUNCTION increment_play_count(media_id UUID)
       RETURNS INTEGER
       LANGUAGE plpgsql
       SECURITY DEFINER
       SET search_path = public
       AS $$
       DECLARE
         new_play_count INTEGER;
       BEGIN
         UPDATE combined_media
         SET plays = COALESCE(plays, 0) + 1
         WHERE id = media_id
         RETURNING plays INTO new_play_count;
         
         RETURN new_play_count;
       END;
       $$;`,
      `GRANT EXECUTE ON FUNCTION increment_play_count(uuid) TO authenticated;`,
      `GRANT EXECUTE ON FUNCTION increment_play_count(uuid) TO anon;`
    ];
    
    for (const sql of queries) {
      console.log('Executing:', sql.substring(0, 60) + '...');
      const result = await supabase.rpc('query', { query_text: sql });
      if (result.error) {
        console.error('SQL Error:', result.error);
      } else {
        console.log('Success!');
      }
    }
  } else {
    console.log('Success!', data);
  }
  
  // Test the function
  console.log('\nTesting function on a track...');
  const { data: testData, error: testError } = await supabase
    .rpc('increment_play_count', { media_id: 'a4a919d0-3d0d-4de4-8372-7238abef8a87' });
  
  if (testError) {
    console.error('Test Error:', testError);
  } else {
    console.log('Test Success! New play count:', testData);
  }
}

applyHotfix().catch(console.error);
