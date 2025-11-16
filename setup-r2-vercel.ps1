# Set R2 Environment Variables in Vercel
# Run this script to configure R2 storage in Vercel

Write-Host "🚀 Setting up R2 Storage in Vercel..." -ForegroundColor Cyan
Write-Host ""

# Check if Vercel CLI is installed
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g vercel
}

Write-Host "📝 Adding R2 environment variables to Vercel..." -ForegroundColor Green
Write-Host ""

# R2 Configuration
$env_vars = @{
    "R2_ACCOUNT_ID" = "95945bf0209126d122b1f04463871ebf"
    "R2_ENDPOINT" = "https://95945bf0209126d122b1f04463871ebf.r2.cloudflarestorage.com"
    "R2_ACCESS_KEY_ID" = "4c02d4ab71ac05efbf7e8c01b8bcc1eb"
    "R2_SECRET_ACCESS_KEY" = "e57ed23cb9c29a7cfc3a0359c7f38ac49edd5e761c6737bf93400fb3aad25109"
    "R2_BUCKET_NAME" = "444radio-media"
    "R2_PUBLIC_URL" = "https://pub-e5b60d303c5547e891ae88829c469ed6.r2.dev"
    "NEXT_PUBLIC_R2_AUDIO_URL" = "https://pub-e5b60d303c5547e891ae88829c469ed6.r2.dev"
    "NEXT_PUBLIC_R2_IMAGES_URL" = "https://pub-e5b60d303c5547e891ae88829c469ed6.r2.dev"
    "NEXT_PUBLIC_R2_VIDEOS_URL" = "https://pub-e5b60d303c5547e891ae88829c469ed6.r2.dev"
}

Write-Host "Adding environment variables for all environments (production, preview, development)..." -ForegroundColor Cyan
Write-Host ""

foreach ($key in $env_vars.Keys) {
    $value = $env_vars[$key]
    Write-Host "  Setting $key..." -NoNewline
    
    # Add to production
    vercel env add $key production --force 2>$null <<< $value
    
    # Add to preview
    vercel env add $key preview --force 2>$null <<< $value
    
    # Add to development
    vercel env add $key development --force 2>$null <<< $value
    
    Write-Host " ✓" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ R2 environment variables configured in Vercel!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Deploy to Vercel: git push" -ForegroundColor White
Write-Host "  2. Test connection: https://www.444radio.co.in/api/r2/test-connection" -ForegroundColor White
Write-Host "  3. Check library: https://www.444radio.co.in/library" -ForegroundColor White
Write-Host ""
