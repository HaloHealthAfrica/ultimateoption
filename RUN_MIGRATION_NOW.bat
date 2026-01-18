@echo off
REM Windows batch script to run the migration
REM 
REM INSTRUCTIONS:
REM 1. Get your DATABASE_URL from Vercel:
REM    - Go to https://vercel.com/your-project/settings/environment-variables
REM    - Copy the DATABASE_URL value (starts with postgresql://)
REM 2. Replace YOUR_DATABASE_URL_HERE below with your actual connection string
REM 3. Run this script: RUN_MIGRATION_NOW.bat

echo ========================================
echo Phase 2.5 Database Migration
echo ========================================
echo.

REM Set your DATABASE_URL here (replace the placeholder)
set DATABASE_URL=YOUR_DATABASE_URL_HERE

REM Check if DATABASE_URL was set
if "%DATABASE_URL%"=="YOUR_DATABASE_URL_HERE" (
    echo ERROR: You need to edit this file and set your DATABASE_URL
    echo.
    echo Steps:
    echo 1. Open RUN_MIGRATION_NOW.bat in a text editor
    echo 2. Replace YOUR_DATABASE_URL_HERE with your actual Neon connection string
    echo 3. Save the file
    echo 4. Run this script again
    echo.
    pause
    exit /b 1
)

echo Running migration...
echo.

node scripts/add-gate-results-column.js

echo.
echo ========================================
echo Migration Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Send test webhooks via /webhook-tester
echo 2. Check Phase 2.5 dashboard for new decisions
echo 3. Verify no more "column does not exist" errors
echo.
pause
