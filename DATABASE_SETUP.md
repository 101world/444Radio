# Code Redemption Database Setup

## Overview
This setup adds persistent tracking for code redemptions with **one-month, one-time access** per user.

## Features
✅ **One-time per month**: Each user can redeem a code once per month  
✅ **Persistent tracking**: Redemptions survive server restarts  
✅ **Audit trail**: Complete history of all redemptions  
✅ **Auto-renewal**: After 30 days, users can redeem the same code again  

## Database Schema

### Table: `code_redemptions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `clerk_user_id` | TEXT | Clerk user ID |
| `code` | TEXT | Redemption code (uppercase) |
| `credits_awarded` | INTEGER | Credits given |
| `redeemed_at` | TIMESTAMPTZ | Last redemption timestamp |
| `redemption_count` | INTEGER | Total redemptions by this user |
| `created_at` | TIMESTAMPTZ | Record creation time |

**Constraint**: `UNIQUE(clerk_user_id, code)` - One record per user+code combination

## Setup Instructions

### Option 1: Run SQL Migration (Recommended)

1. Open your Supabase dashboard
2. Go to **SQL Editor**
3. Copy the contents of `supabase/migrations/create_code_redemptions.sql`
4. Paste and run the SQL

### Option 2: Manual Table Creation

Run this SQL in Supabase SQL Editor:

```sql
CREATE TABLE code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  credits_awarded INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  redemption_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_code UNIQUE (clerk_user_id, code)
);

CREATE INDEX idx_code_redemptions_user ON code_redemptions(clerk_user_id);
CREATE INDEX idx_code_redemptions_code ON code_redemptions(code);
CREATE INDEX idx_code_redemptions_recent ON code_redemptions(clerk_user_id, code, redeemed_at);
```

## How It Works

### First Redemption
1. User enters code "FREE THE MUSIC"
2. System checks database for existing redemption
3. No record found → Creates new record with current timestamp
4. Awards 10 credits
5. Shows: "Credits awarded! This code can be redeemed again in one month."

### Attempted Re-redemption (Within 30 Days)
1. User tries same code within 30 days
2. System finds existing redemption with recent `redeemed_at`
3. Returns error: "Code already redeemed. Each code can only be used once per month."
4. No credits awarded

### Re-redemption After 30 Days
1. User tries same code after 30+ days
2. System finds existing redemption but `redeemed_at` is older than 30 days
3. Updates `redeemed_at` to current time
4. Increments `redemption_count`
5. Awards credits again
6. Shows success message

## Valid Codes

| Code | Credits | Description |
|------|---------|-------------|
| `PORSCHE` | 100 | Special promotional code |
| `FREE THE MUSIC` | 10 | Decrypt page password reward |

## Testing

### Test 1: First Redemption
```bash
# Should succeed and award credits
curl -X POST http://localhost:3000/api/credits/award \
  -H "Content-Type: application/json" \
  -d '{"code": "free the music"}'
```

### Test 2: Immediate Re-redemption
```bash
# Should fail with "already redeemed" error
curl -X POST http://localhost:3000/api/credits/award \
  -H "Content-Type: application/json" \
  -d '{"code": "FREE THE MUSIC"}'
```

### Test 3: Check Database
```sql
-- View all redemptions
SELECT 
  clerk_user_id,
  code,
  credits_awarded,
  redeemed_at,
  redemption_count,
  CURRENT_TIMESTAMP - redeemed_at AS time_since_redemption
FROM code_redemptions
ORDER BY redeemed_at DESC;
```

### Test 4: Simulate 30-Day Expiration
```sql
-- Manually set redemption to 31 days ago for testing
UPDATE code_redemptions
SET redeemed_at = NOW() - INTERVAL '31 days'
WHERE code = 'FREE THE MUSIC'
  AND clerk_user_id = 'your_user_id_here';

-- Now try redeeming again - should succeed
```

## Security Features

1. **Unique constraint**: Prevents database-level duplicate redemptions
2. **Timestamp validation**: Server-side date math prevents tampering
3. **Service role key**: Uses Supabase admin access to prevent client manipulation
4. **Error handling**: Graceful degradation if database is unavailable

## Monitoring

Query to see redemption statistics:

```sql
-- Redemption counts per code
SELECT 
  code,
  COUNT(*) as total_users,
  SUM(credits_awarded) as total_credits_awarded,
  SUM(redemption_count) as total_redemptions,
  MAX(redeemed_at) as last_redemption
FROM code_redemptions
GROUP BY code
ORDER BY total_credits_awarded DESC;

-- Active redemptions (within last 30 days)
SELECT 
  code,
  COUNT(*) as active_users
FROM code_redemptions
WHERE redeemed_at > NOW() - INTERVAL '30 days'
GROUP BY code;
```

## Troubleshooting

### Error: "Failed to verify code status"
- Check Supabase connection
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set
- Check table exists and has correct schema

### Error: "duplicate key value violates unique constraint"
- This means the unique constraint is working correctly
- Should be handled by the code and return proper error message

### Users can redeem multiple times
- Check that table was created with `unique_user_code` constraint
- Verify indexes are created
- Check server logs for database errors

## Migration Rollback

If you need to remove the table:

```sql
DROP TABLE IF EXISTS code_redemptions CASCADE;
```

## Future Enhancements

- [ ] Add `expires_at` column for code-specific expiration dates
- [ ] Add `max_redemptions` column to limit total uses per code
- [ ] Add admin dashboard to view/manage redemptions
- [ ] Add webhook notifications for code redemptions
- [ ] Add analytics tracking for popular codes
