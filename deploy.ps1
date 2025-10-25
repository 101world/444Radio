#!/usr/bin/env pwsh
# Quick deployment script for Windows PowerShell

Write-Host "🚀 444 RADIO - Quick Deploy Script" -ForegroundColor Cyan
Write-Host ""

# Check if vercel CLI is installed
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g vercel
}

Write-Host "✅ Vercel CLI found" -ForegroundColor Green
Write-Host ""

# Show deployment options
Write-Host "Choose deployment method:" -ForegroundColor Cyan
Write-Host "1. Deploy to production (recommended)"
Write-Host "2. Deploy preview"
Write-Host "3. Link to existing Vercel project"
Write-Host "4. Exit"
Write-Host ""

$choice = Read-Host "Enter choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "🚀 Deploying to production..." -ForegroundColor Cyan
        vercel --prod
    }
    "2" {
        Write-Host ""
        Write-Host "🔍 Deploying preview..." -ForegroundColor Cyan
        vercel
    }
    "3" {
        Write-Host ""
        Write-Host "🔗 Linking to Vercel project..." -ForegroundColor Cyan
        vercel link
    }
    "4" {
        Write-Host "👋 Exiting..." -ForegroundColor Yellow
        exit
    }
    default {
        Write-Host "❌ Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Done!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Remember to:" -ForegroundColor Yellow
Write-Host "  - Set all environment variables in Vercel dashboard"
Write-Host "  - Run database migrations if needed"
Write-Host "  - Test the deployment"
Write-Host ""
Write-Host "📖 See DEPLOYMENT.md for full instructions" -ForegroundColor Cyan
