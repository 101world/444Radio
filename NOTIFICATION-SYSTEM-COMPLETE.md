# 444Radio Notification System - Complete Implementation

## ✅ Notification Types Implemented

### 1. **Social Interactions**
- **Like** - When someone likes your track
  - Shows who liked it and which track
  - Includes track title in notification
  
- **Follow** - When someone follows you
  - Shows who followed you

### 2. **Marketplace & Revenue**
- **Purchase** - When someone buys your track on EARN marketplace
  - Shows buyer, track name, and amount paid
  
- **Revenue Earned** - Detailed revenue notification
  - Shows exact credits earned and source
  - Includes buyer details

- **Download** - When your track is downloaded

### 3. **Wallet & Billing**
- **Wallet Deposit** - When money is added to your wallet
  - Shows amount and currency (₹/INR)
  - Includes transaction ID
  
- **Wallet Conversion** - When you convert wallet balance to credits
  - Shows credits gained and amount spent
  
- **Billing** - Payment success/failure notifications
  - Real-time payment status updates

### 4. **Credits**
- **Credit Purchase** - When you buy credits
- **Credit Award** - When you receive free credits
- **Credit Deduct** - When credits are used for generations

### 5. **AI Generation**
- **Generation Complete** - When your AI music/image/video is ready
  - Shows media type and title
  - Direct link to view the content
  
- **Generation Failed** - When generation fails
  - Shows error reason
  - Confirms credits were refunded

### 6. **Gamification**
- **Quest Complete** - When you complete a quest
  - Shows reward amount
  
- **Achievement** - When you unlock an achievement
  - Shows bonus credits if any

### 7. **Subscription & System**
- **Subscription** - Status updates (active/cancelled/expired)
- **System** - Important system announcements

---

## 📍 Where Notifications Fire

### Active Endpoints with Notifications:

1. `/api/media/like` → Like notifications
2. `/api/profile/follow` → Follow notifications
3. `/api/earn/purchase` → Purchase + Revenue notifications
4. `/api/wallet/convert` → Wallet conversion notifications
5. `/api/webhooks/razorpay` → Wallet deposit + Billing notifications
6. `/api/generate/finalize` → Generation complete notifications

---

## 🔔 How It Works

1. **Real-Time Updates**: Notifications appear instantly in the bell icon
2. **Unread Badge**: Red badge shows count of unread notifications
3. **Non-Blocking**: All notifications are created asynchronously - they won't slow down app performance
4. **Automatic**: No code changes needed for new events - just call the helper functions

---

## 🛠️ Adding New Notifications

Use the helper functions in `lib/notifications.ts`:

```typescript
import { notifyLike, notifyPurchase, notifyWalletDeposit } from '@/lib/notifications'

// Example: Notify when someone likes a track
await notifyLike(ownerId, likerId, mediaId, "Track Title")

// Example: Notify wallet deposit
await notifyWalletDeposit(userId, 500, 'INR', transactionId)

// Example: Notify generation complete
await notifyGenerationComplete(userId, mediaId, 'music', 'My New Track')
```

All helpers are documented with JSDoc in `lib/notifications.ts`.

---

## ⚠️ IMPORTANT: Database Setup Required

The `notifications` table must be created in Supabase before notifications will work.

### Run this SQL in Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
```

**SQL is already in your clipboard** - just paste and run in:  
https://supabase.com/dashboard/project/yirjulakkgignzbrqnth/sql/new

---

## 🎯 Next Steps

1. **Create the table** (SQL above)
2. **Test with a like or follow** - notifications should appear instantly
3. **Check the bell icon** - should show unread count
4. **Convert wallet to credits** - should get notification
5. **Purchase a track** - both buyer and seller get notifications

---

## 📊 Notification Data Structure

Each notification has:
- `id` - Unique identifier
- `user_id` - Who receives it (Clerk user ID)
- `type` - Type of notification (like, follow, purchase, etc.)
- `data` - Event-specific data (JSONB)
  - Always includes a `message` field for display
  - May include `by` (who triggered it), `amount`, `mediaId`, etc.
- `read_at` - Timestamp when marked as read (null = unread)
- `created_at` - When notification was created

---

## 🚀 Deployment Status

✅ Code deployed to GitHub  
✅ Pushed to origin/master  
✅ Vercel will auto-deploy  
⏳ **Waiting for**: Supabase table creation (manual step)

Once the table is created, all notifications will start working immediately!
