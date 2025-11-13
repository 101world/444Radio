$filePath = "c:\444Radio\app\page.tsx"
$content = Get-Content $filePath -Raw
$content = $content -replace 'describe your sound\.\.\.', 'Describe Your Sound...'
$content | Set-Content $filePath -NoNewline
Write-Host "Replaced text in $filePath"
