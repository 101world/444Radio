const { Client } = require('pg');

const connectionString = process.env.PG_CONNECTION_STRING || process.env.DATABASE_URL || 'postgresql://postgres.yirjulakkgignzbrqnth:Patnibillions09!@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to Supabase');

  // 1. Create table
  await client.query(`
    CREATE TABLE IF NOT EXISTS boost_logs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL,
      prediction_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'canceled')),
      source_audio_url TEXT NOT NULL,
      track_title TEXT,
      bass_boost NUMERIC DEFAULT 0,
      treble_boost NUMERIC DEFAULT 0,
      volume_boost NUMERIC DEFAULT 2,
      normalize BOOLEAN DEFAULT true,
      noise_reduction BOOLEAN DEFAULT false,
      output_format TEXT DEFAULT 'mp3',
      bitrate TEXT DEFAULT '192k',
      output_audio_url TEXT,
      replicate_output_url TEXT,
      library_id UUID,
      credits_charged INTEGER DEFAULT 0,
      credits_remaining INTEGER,
      replicate_predict_time NUMERIC,
      replicate_total_time NUMERIC,
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      completed_at TIMESTAMPTZ
    )
  `);
  console.log('✅ Table created');

  // 2. RLS
  await client.query('ALTER TABLE boost_logs ENABLE ROW LEVEL SECURITY');
  console.log('✅ RLS enabled');

  // 3. Indexes
  await client.query('CREATE INDEX IF NOT EXISTS idx_boost_logs_user ON boost_logs(user_id, created_at DESC)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_boost_logs_status ON boost_logs(status)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_boost_logs_prediction ON boost_logs(prediction_id) WHERE prediction_id IS NOT NULL');
  console.log('✅ Indexes created');

  // 4. RLS policy
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'boost_logs'
          AND policyname = 'Service role full access on boost_logs'
      ) THEN
        CREATE POLICY "Service role full access on boost_logs"
          ON boost_logs FOR ALL
          USING (auth.role() = 'service_role');
      END IF;
    END $$
  `);
  console.log('✅ RLS policy created');

  // 5. Also fix credit_transactions CHECK to include generation_audio_boost
  try {
    // Drop old check constraint and recreate with audio_boost
    const checkResult = await client.query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'credit_transactions' AND constraint_type = 'CHECK'
    `);
    console.log('Existing CHECK constraints:', checkResult.rows.map(r => r.constraint_name));

    // Find the type check constraint
    for (const row of checkResult.rows) {
      const defResult = await client.query(`
        SELECT pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conname = $1
      `, [row.constraint_name]);
      const def = defResult.rows[0]?.def || '';
      if (def.includes('generation_music') && !def.includes('generation_audio_boost')) {
        console.log('Fixing constraint:', row.constraint_name);
        await client.query(`ALTER TABLE credit_transactions DROP CONSTRAINT "${row.constraint_name}"`);
        await client.query(`
          ALTER TABLE credit_transactions ADD CONSTRAINT "${row.constraint_name}" CHECK (type IN (
            'generation_music',
            'generation_effects',
            'generation_loops',
            'generation_image',
            'generation_video_to_audio',
            'generation_cover_art',
            'generation_stem_split',
            'generation_audio_boost',
            'earn_list',
            'earn_purchase',
            'earn_sale',
            'earn_admin',
            'credit_award',
            'credit_refund',
            'subscription_bonus',
            'code_claim',
            'other'
          ))
        `);
        console.log('✅ credit_transactions CHECK updated with generation_audio_boost');
      } else if (def.includes('generation_audio_boost')) {
        console.log('✅ generation_audio_boost already in CHECK constraint');
      }
    }
  } catch (e) {
    console.error('⚠️ CHECK constraint update failed (non-fatal):', e.message);
  }

  await client.end();
  console.log('\n🎉 ALL DONE - boost_logs table ready');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
