/**
 * Test R2 connection with current credentials
 * Run: node scripts/test-r2-connection.js
 */

const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function testR2Connection() {
  console.log('🔍 Testing R2 Configuration...\n');

  // Check environment variables
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || '444radio-media';
  const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

  console.log('Environment Variables:');
  console.log('- R2_ACCOUNT_ID:', accountId ? '✅ Set' : '❌ Missing');
  console.log('- R2_ACCESS_KEY_ID:', accessKeyId ? `✅ Set (${accessKeyId.substring(0, 8)}...)` : '❌ Missing');
  console.log('- R2_SECRET_ACCESS_KEY:', secretAccessKey ? '✅ Set (hidden)' : '❌ Missing');
  console.log('- R2_BUCKET_NAME:', bucketName);
  console.log('- R2_ENDPOINT:', endpoint);
  console.log();

  if (!accessKeyId || !secretAccessKey) {
    console.error('❌ Missing required credentials');
    console.log('\nPlease set in Vercel:');
    console.log('1. R2_ACCESS_KEY_ID');
    console.log('2. R2_SECRET_ACCESS_KEY');
    console.log('3. R2_ACCOUNT_ID (or R2_ENDPOINT)');
    process.exit(1);
  }

  // Create R2 client
  const client = new S3Client({
    region: 'auto',
    endpoint: endpoint,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });

  console.log('📡 Testing connection to R2...');

  try {
    // Try to list objects in bucket
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 5
    });

    const response = await client.send(command);
    
    console.log('✅ Connection successful!');
    console.log(`📦 Bucket: ${bucketName}`);
    console.log(`📄 Objects found: ${response.KeyCount || 0}`);
    
    if (response.Contents && response.Contents.length > 0) {
      console.log('\nSample files:');
      response.Contents.slice(0, 3).forEach(obj => {
        console.log(`  - ${obj.Key} (${(obj.Size / 1024).toFixed(2)} KB)`);
      });
    }

    console.log('\n✅ R2 is configured correctly!');
    console.log('You can now generate content and it will be stored permanently.');
    
  } catch (error) {
    console.error('❌ Connection failed!');
    console.error('Error:', error.message);
    
    if (error.message.includes('signature')) {
      console.log('\n🔑 Signature Error - This means:');
      console.log('1. Access Key ID or Secret Access Key is incorrect');
      console.log('2. The API token might have been rolled/regenerated');
      console.log('\n📋 To fix:');
      console.log('1. Go to Cloudflare Dashboard → R2 → Manage API Tokens');
      console.log('2. Delete old token and create a new one');
      console.log('3. Copy the NEW credentials to Vercel environment variables');
      console.log('4. Redeploy on Vercel');
    } else if (error.message.includes('NoSuchBucket')) {
      console.log('\n📦 Bucket Error - This means:');
      console.log('1. Bucket name is incorrect');
      console.log('2. Check R2_BUCKET_NAME = "444radio-media"');
    }
    
    process.exit(1);
  }
}

testR2Connection();
