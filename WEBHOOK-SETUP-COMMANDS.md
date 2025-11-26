# 🚀 Quick Setup Commands

## 1. Set Pusher Environment Variables in Vercel

Go to [Vercel Dashboard](https://vercel.com/444radio/dashboard) → Settings → Environment Variables

Add these:

```
PUSHER_APP_ID=<get from pusher.com>
PUSHER_KEY=<get from pusher.com>
PUSHER_SECRET=<get from pusher.com>
PUSHER_CLUSTER=us2

NEXT_PUBLIC_PUSHER_KEY=<same as PUSHER_KEY>
NEXT_PUBLIC_PUSHER_CLUSTER=us2

NEXT_PUBLIC_APP_URL=https://www.444radio.co.in
```

## 2. Run Database Migration

Copy/paste in Supabase SQL editor:

```sql
-- File: db/migrations/008_studio_jobs.sql

CREATE TABLE IF NOT EXISTS studio_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  params JSONB DEFAULT '{}',
  replicate_prediction_id TEXT,
  output JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_jobs_user_id ON studio_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_jobs_status ON studio_jobs(status);
CREATE INDEX IF NOT EXISTS idx_studio_jobs_replicate_id ON studio_jobs(replicate_prediction_id);
CREATE INDEX IF NOT EXISTS idx_studio_jobs_created_at ON studio_jobs(created_at DESC);

ALTER TABLE studio_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs"
  ON studio_jobs FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert own jobs"
  ON studio_jobs FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
```

## 3. Deploy

```powershell
git push origin master
```

## 4. Test

1. Go to: https://www.444radio.co.in/studio/multi-track
2. Press **B** key (beat generation)
3. Enter: `lofi chill beat 90 bpm`
4. Click "Generate"

**Expected:**
- Credits decrease by 5
- "Generating..." appears
- After ~30s: Track auto-adds to timeline
- Success notification shows

## 5. Verify

### Check Pusher Dashboard
https://dashboard.pusher.com → Debug Console → Watch for `job:completed` events

### Check Database
```sql
SELECT * FROM studio_jobs ORDER BY created_at DESC LIMIT 5;
```

### Check Browser Console
Should see:
```
🔌 Pusher connected
📡 Subscribed to channel: private-user-user_xxx
🎉 Job completed via Pusher: {...}
✨ Beat added to timeline!
```

---

## ✅ Done!

You now have a production-ready webhook-based AI generation system with real-time updates.

**Docs:**
- `WEBHOOK-GENERATION-SETUP.md` - Full guide
- `WEBHOOK-QUICK-REF.md` - Quick reference
- `WEBHOOK-COMPLETE.md` - Implementation summary
