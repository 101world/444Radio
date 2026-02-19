# 444Radio - SQL Files Cleanup Script
# Run this to organize the 235 SQL files in your root directory

Write-Host "🧹 444Radio SQL Cleanup Script" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Create archive directory
$archiveDir = "archive\sql-fixes-2026"
$docsDir = "docs\sql-queries"

Write-Host "Creating directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $archiveDir | Out-Null
New-Item -ItemType Directory -Force -Path $docsDir | Out-Null

# Move completed fixes
Write-Host "`nMoving completed fixes to archive..." -ForegroundColor Yellow
$fixFiles = @(
    "CHECK_*.sql",
    "VERIFY_*.sql", 
    "FIX_*.sql",
    "RESTORE_*.sql",
    "REBUILD_*.sql",
    "URGENT_*.sql",
    "RUN_*.sql",
    "SIMPLE_*.sql",
    "QUICK_*.sql",
    "SUPABASE_*.sql",
    "TRANSFER_*.sql",
    "WHO_*.sql"
)

$movedCount = 0
foreach ($pattern in $fixFiles) {
    $files = Get-ChildItem -Path . -Filter $pattern -File
    foreach ($file in $files) {
        Move-Item -Path $file.FullName -Destination $archiveDir -Force
        $movedCount++
        Write-Host "  ✓ Moved: $($file.Name)" -ForegroundColor Green
    }
}

# Move diagnostic queries
Write-Host "`nMoving diagnostic queries to docs..." -ForegroundColor Yellow
$diagFiles = @(
    "check-*.sql",
    "test-*.sql",
    "show-*.sql",
    "audit-*.sql"
)

$diagCount = 0
foreach ($pattern in $diagFiles) {
    $files = Get-ChildItem -Path . -Filter $pattern -File
    foreach ($file in $files) {
        Move-Item -Path $file.FullName -Destination $docsDir -Force
        $diagCount++
        Write-Host "  ✓ Moved: $($file.Name)" -ForegroundColor Green
    }
}

# List remaining SQL files in root
Write-Host "`n📋 Remaining SQL files in root:" -ForegroundColor Cyan
$remaining = Get-ChildItem -Path . -Filter "*.sql" -File
if ($remaining.Count -gt 0) {
    foreach ($file in $remaining) {
        Write-Host "  • $($file.Name)" -ForegroundColor White
    }
    Write-Host "`nℹ️  Review these files manually and decide if they should be:" -ForegroundColor Yellow
    Write-Host "   1. Moved to db/migrations/ (if they're proper migrations)" -ForegroundColor Gray
    Write-Host "   2. Moved to archive/ (if they're one-time fixes)" -ForegroundColor Gray
    Write-Host "   3. Deleted (if they're duplicates or obsolete)" -ForegroundColor Gray
} else {
    Write-Host "  ✓ All SQL files organized!" -ForegroundColor Green
}

# Summary
Write-Host "`n📊 Cleanup Summary:" -ForegroundColor Cyan
Write-Host "  • Moved $movedCount files to archive/" -ForegroundColor Green
Write-Host "  • Moved $diagCount files to docs/sql-queries/" -ForegroundColor Green
Write-Host "  • Remaining in root: $($remaining.Count)" -ForegroundColor $(if ($remaining.Count -eq 0) { "Green" } else { "Yellow" })

# Git status
Write-Host "`n🔍 Git Status:" -ForegroundColor Cyan
git status --short

Write-Host "`n✅ Cleanup complete! Next steps:" -ForegroundColor Green
Write-Host "   1. Review remaining SQL files in root" -ForegroundColor Gray
Write-Host "   2. Run: git add archive/ docs/sql-queries/" -ForegroundColor Gray
Write-Host "   3. Run: git commit -m 'chore: organize SQL files into archive and docs'" -ForegroundColor Gray
Write-Host "   4. Check COMPREHENSIVE-AUDIT-REPORT-2026-02-19.md for next actions" -ForegroundColor Gray
