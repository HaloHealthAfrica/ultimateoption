# How to Run the Database Migration

The migration has been deployed. You have **3 options** to run it:

## Option 1: Using the Web Interface (Easiest)

1. Wait for Vercel deployment to complete
2. Open this URL in your browser:
   ```
   https://your-app.vercel.app/run-migration.html
   ```
3. Click the "Run Migration" button
4. Wait for the success message

## Option 2: Using curl (Command Line)

Run this command in your terminal:

```bash
curl -X POST https://your-app.vercel.app/api/webhooks/migrate \
  -H "Content-Type: application/json" \
  | json_pp
```

Or on Windows PowerShell:

```powershell
Invoke-RestMethod -Uri "https://your-app.vercel.app/api/webhooks/migrate" -Method POST | ConvertTo-Json -Depth 10
```

## Option 3: Using Browser DevTools

1. Go to your app: `https://your-app.vercel.app`
2. Open browser DevTools (F12)
3. Go to Console tab
4. Paste and run:

```javascript
fetch('/api/webhooks/migrate', { method: 'POST' })
  .then(r => r.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
```

## What to Expect

### Success Response:
```json
{
  "success": true,
  "message": "Migration completed successfully",
  "results": [
    {
      "step": "check_columns",
      "existing_columns": ["id", "received_at", "kind", ...],
      "has_raw_payload": false,
      "has_headers": false
    },
    {
      "step": "add_raw_payload",
      "status": "added",
      "message": "Added raw_payload column"
    },
    {
      "step": "add_headers",
      "status": "added",
      "message": "Added headers column"
    },
    ...
  ],
  "next_steps": [
    "Trigger new webhooks from TradingView",
    "New webhooks will have complete payload and header data",
    "Visit /api/webhooks/recent to see the data",
    "Click on webhook rows in the UI to expand and view details"
  ]
}
```

### If Already Migrated:
```json
{
  "success": true,
  "message": "Migration completed successfully",
  "results": [
    {
      "step": "add_raw_payload",
      "status": "skipped",
      "message": "raw_payload column already exists"
    },
    {
      "step": "add_headers",
      "status": "skipped",
      "message": "headers column already exists"
    }
  ]
}
```

## After Migration

1. **Trigger new webhooks** from TradingView
2. Go to your webhook receipts page
3. Click on a webhook row to expand it
4. You should now see:
   - ✅ **Raw Payload** section with complete JSON
   - ✅ **Headers** section with all HTTP headers

## Troubleshooting

### Migration fails with "Database not configured"
- Check that `DATABASE_URL` is set in your Vercel environment variables

### Migration succeeds but still no data showing
- Old webhooks (before migration) will have NULL values
- Trigger **new** webhooks to see the data
- Check `/api/webhooks/recent` to verify the API is returning the fields

### Still having issues?
- Check Vercel logs for errors
- Verify the migration ran successfully by checking the response
- Try running the migration again (it's safe to run multiple times)
