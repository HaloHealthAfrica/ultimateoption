# Webhook Display Updates

## Changes Made

### 1. Enhanced Webhook Table Display
- **Expanded Message Column**: Increased minimum width to 400px and maximum to 600px
- **Removed Truncation**: Messages now display in full with word wrapping instead of being truncated
- **Improved Layout**: Table width increased to accommodate full message display
- **Better UX**: "View full details" button moved below the message for cleaner layout

### 2. Complete Payload Storage
- **Database Schema**: Added `raw_payload` (TEXT) and `headers` (JSONB) columns to `webhook_receipts` table
- **No More Truncation**: Raw payloads are now stored completely instead of being truncated at 1000 characters
- **Headers Storage**: HTTP request headers are now captured and stored for debugging
- **All Endpoints Updated**: signals, saty-phase, and trend webhook endpoints now store complete data

### 3. Database Migration
- **Migration Script**: `scripts/add-webhook-payload-fields.sql` to add new columns to existing databases
- **Backward Compatible**: New fields are optional, existing functionality continues to work

## Files Modified

### Frontend
- `src/components/dashboard/WebhookMonitor.tsx` - Enhanced table display and message visibility

### Backend
- `src/webhooks/auditDb.ts` - Updated to handle raw_payload and headers fields
- `src/app/api/webhooks/signals/route.ts` - Removed payload truncation, added headers collection
- `src/app/api/webhooks/saty-phase/route.ts` - Added complete payload and headers storage
- `src/app/api/webhooks/trend/route.ts` - Added complete payload and headers storage

### Database
- `src/ledger/schema.neon.sql` - Added raw_payload and headers columns
- `scripts/add-webhook-payload-fields.sql` - Migration script for existing databases

## Benefits

1. **Complete Visibility**: Full webhook messages are now visible in the table without clicking
2. **Better Debugging**: Complete payloads and headers stored for troubleshooting
3. **No Data Loss**: Raw webhook data is preserved entirely for analysis
4. **Improved UX**: Easier to scan webhook messages at a glance

## Migration Required

Run the migration script against your database:
```sql
-- Add the new columns
ALTER TABLE webhook_receipts ADD COLUMN IF NOT EXISTS raw_payload TEXT;
ALTER TABLE webhook_receipts ADD COLUMN IF NOT EXISTS headers JSONB;
```

## Notes

- The in-memory audit log already supported these fields
- Database storage now matches the in-memory capabilities
- Headers exclude sensitive information (authorization, secrets)
- Changes are backward compatible with existing webhook receipts