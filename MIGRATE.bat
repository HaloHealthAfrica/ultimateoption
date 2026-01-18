@echo off
echo ========================================
echo QUICK MIGRATION SCRIPT
echo ========================================
echo.
echo This will run the database migration.
echo You need to paste your DATABASE_URL when prompted.
echo.
echo Get it from: https://vercel.com/your-project/settings/environment-variables
echo.
set /p DATABASE_URL="Paste your DATABASE_URL here and press Enter: "
echo.
echo Running migration...
node scripts/add-gate-results-column.js
echo.
pause
