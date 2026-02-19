// Test script to insert a sample notification for testing
require('dotenv').config({ path: '.env.local' });

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

async function insertTestNotification(userId) {
  try {
    const response = await fetch(`${SB_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        user_id: userId,
        type: 'test',
        data: {
          message: 'This is a test notification!',
          timestamp: new Date().toISOString()
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to insert test notification:', error);
      return;
    }

    const result = await response.json();
    console.log('✅ Test notification created successfully!');
    console.log('Notification ID:', result[0]?.id);
    console.log('User ID:', result[0]?.user_id);
    console.log('Type:', result[0]?.type);
    console.log('\n📱 Check the bell icon in the app header to see your notification!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Get user ID from command line args
const userId = process.argv[2];

if (!userId) {
  console.log('Usage: node scripts/seed-test-notification.js <YOUR_CLERK_USER_ID>');
  console.log('\nExample: node scripts/seed-test-notification.js user_34J8MP3KCfczODGn9yKMolWPX9R');
  console.log('\n💡 You can find your Clerk user ID in the network tab when logged in.');
  process.exit(1);
}

insertTestNotification(userId);
