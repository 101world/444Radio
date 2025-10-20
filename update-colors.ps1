# Color Replacement Script - Mercedes Blue to Royal Indigo
# Old Colors → New Royal Colors
# #2d4a6e → #4f46e5 (dark indigo)
# #3d5a7e → #6366f1 (royal indigo)
# #5a8fc7 → #818cf8 (light indigo)

$files = Get-ChildItem -Path ".\app" -Include *.tsx,*.ts,*.css -Recurse

foreach ($file in $files) {
    $content = Get-Content $file.FullName | Out-String
    
    # Replace colors
    $content = $content -replace '#2d4a6e', '#4f46e5'
    $content = $content -replace '#3d5a7e', '#6366f1'
    $content = $content -replace '#5a8fc7', '#818cf8'
    $content = $content -replace '#1a2332', '#1e1b4b'
    
    $content | Set-Content -Path $file.FullName
}

Write-Host "Color replacement complete!" -ForegroundColor Green
Write-Host "Old Mercedes Blue -> Royal Indigo" -ForegroundColor Cyan
