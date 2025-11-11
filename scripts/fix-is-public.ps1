# Fix is_public for combined_media tracks
# Run this in PowerShell to execute the SQL fix in Supabase

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "FIX: Update is_public flag for combined_media tracks" -ForegroundColor Yellow
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

Write-Host "INSTRUCTIONS:" -ForegroundColor Green
Write-Host "1. Go to your Supabase Dashboard" -ForegroundColor White
Write-Host "2. Navigate to SQL Editor" -ForegroundColor White
Write-Host "3. Copy and paste the SQL below" -ForegroundColor White
Write-Host "4. Run the query" -ForegroundColor White
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Read and display the SQL file
$sqlContent = Get-Content "db\migrations\fix-is-public-combined-media.sql" -Raw
Write-Host $sqlContent -ForegroundColor Yellow

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "After running this, all existing releases will be visible on explore!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
