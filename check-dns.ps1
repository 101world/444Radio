# DNS Verification Script for 444RADIO.CO.IN
# Run this in PowerShell after updating DNS records

Write-Host "🔍 Checking DNS Records for 444radio.co.in..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Yellow

# Check A record for root domain
Write-Host "`n📋 Checking A record for 444radio.co.in:" -ForegroundColor Green
try {
    $aRecord = Resolve-DnsName -Name "444radio.co.in" -Type A -ErrorAction Stop
    Write-Host "✅ A Record Found:" -ForegroundColor Green
    $aRecord | Select-Object Name, Type, IPAddress | Format-Table -AutoSize
} catch {
    Write-Host "❌ A Record Not Found or Error:" $_.Exception.Message -ForegroundColor Red
}

# Check CNAME record for www subdomain
Write-Host "`n📋 Checking CNAME record for www.444radio.co.in:" -ForegroundColor Green
try {
    $cnameRecord = Resolve-DnsName -Name "www.444radio.co.in" -Type CNAME -ErrorAction Stop
    Write-Host "✅ CNAME Record Found:" -ForegroundColor Green
    $cnameRecord | Select-Object Name, Type, NameHost | Format-Table -AutoSize
} catch {
    Write-Host "❌ CNAME Record Not Found or Error:" $_.Exception.Message -ForegroundColor Red
}

# Check if website is accessible
Write-Host "`n🌐 Testing website accessibility:" -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "https://444radio.co.in" -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✅ Website is accessible! Status:" $response.StatusCode -ForegroundColor Green
} catch {
    Write-Host "❌ Website not accessible:" $_.Exception.Message -ForegroundColor Red
}

Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
Write-Host "1. If DNS records are correct but website doesn't load, wait longer for propagation" -ForegroundColor White
Write-Host "2. Check Vercel dashboard for domain verification status" -ForegroundColor White
Write-Host "3. Clear browser cache and try incognito mode" -ForegroundColor White
Write-Host "4. Contact GoDaddy support if DNS records won't save" -ForegroundColor White

Write-Host "`n🔄 Run this script again in 30 minutes if records aren't showing yet." -ForegroundColor Yellow