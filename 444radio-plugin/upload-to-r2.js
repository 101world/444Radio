// Upload the VST3 zip to R2 for public download
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

async function upload() {
  const r2 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  })

  const zipPath = path.join(__dirname, '444Radio-Plugin-v2-Windows.zip')
  const buffer = fs.readFileSync(zipPath)
  const key = 'downloads/444Radio-Plugin-v2-Windows.zip'

  console.log(`Uploading ${(buffer.length / 1024 / 1024).toFixed(2)} MB to R2...`)

  await r2.send(new PutObjectCommand({
    Bucket: '444radio-media',
    Key: key,
    Body: buffer,
    ContentType: 'application/zip',
    ContentDisposition: 'attachment; filename="444Radio-Plugin-v2-Windows.zip"',
  }))

  const url = `https://media.444radio.co.in/${key}`
  console.log(`✅ Uploaded: ${url}`)
}

upload().catch(err => { console.error('❌', err.message); process.exit(1) })
