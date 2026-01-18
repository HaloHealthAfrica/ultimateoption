# PowerShell script to run the migration
#
# INSTRUCTIONS:
# 1. Get your DATABASE_URL from Vercel:
#    - Go to https://vercel.com/your-project/settings/environment-variables
#    - Copy the DATABASE_URL value (starts with postgresql://)
# 2. Replace YOUR_DATABASE_URL_HERE below with your actual connection string
# 3. Run this script: .\RUN_MIGRATION_NOW.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 2.5 Database Migration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set your DATABASE_URL here (replace the placeholder)
$env:DATABASE_URL = "YOUR_DATABASE_URL_HERE"

# Check if DATABASE_URL was set
if ($env:DATABASE_URL -eq "YOUR_DATABASE_URL_HERE") {
    Write-Host "ERROR: You need to edit this file and set your DATABASE_URL" -ForegroundColor Red
    Write-Host ""
    Write-Host "Steps:" -ForegroundColor Yellow
    Write-Host "1. Open RUN_MIGRATION_NOW.ps1 in a text editor"
    Write-Host "2. Replace YOUR_DATABASE_URL_HERE with your actual Neon connection string"
    Write-Host "3. Save the file"
    Write-Host "4. Run this script again: .\RUN_MIGRATION_NOW.ps1"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Running migration..." -ForegroundColor Yellow
Write-Host ""

node scripts/add-gate-results-column.js

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Migration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Send test webhooks via /webhook-tester"
Write-Host "2. Check Phase 2.5 dashboard for new decisions"
Write-Host "3. Verify no more 'column does not exist' errors"
Write-Host ""
Read-Host "Press Enter to exit"
