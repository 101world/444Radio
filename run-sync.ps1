# Run this in PowerShell to sync all subscribers

$response = Invoke-RestMethod -Uri "https://444radio.co.in/api/admin/sync-subscribers" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer your-admin-secret-here"
        "Content-Type" = "application/json"
    }

$response | ConvertTo-Json -Depth 10
