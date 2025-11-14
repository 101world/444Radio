import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Query the information schema to get column names
    const { data, error } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'combined_media'
          ORDER BY ordinal_position;
        `
      })

    if (error) {
      // If RPC doesn't work, try a simple test insert
      const testInsert = await supabase
        .from('combined_media')
        .insert({
          user_id: 'test',
          audio_url: 'test',
          image_url: 'test',
          title: 'test',
          content_type: 'test',
          is_public: true,
          created_at: new Date().toISOString(),
          // Test if these columns exist
          audio_prompt: 'test',
          genre: 'test',
          mood: 'test'
        })
        .select()

      return NextResponse.json({
        method: 'test_insert',
        insertError: testInsert.error,
        message: testInsert.error ? 'Columns missing: ' + testInsert.error.message : 'All columns exist!'
      })
    }

    return NextResponse.json({
      method: 'schema_query',
      columns: data,
      totalColumns: data?.length || 0
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
