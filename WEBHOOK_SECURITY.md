# Webhook Security Setup

## Overview

All webhook endpoints now support secure authentication to prevent unauthorized access and ensure data integrity.

## 🔐 **Authentication Methods**

### Method 1: HMAC-SHA256 Signature (Recommended)
- **Header**: `x-hub-signature-256`, `x-signature`, or `signature`
- **Format**: `sha256=<hex_signature>` or just `<hex_signature>`
- **Algorithm**: HMAC-SHA256 of the request body using your webhook secret

### Method 2: Bearer Token
- **Header**: `Authorization: Bearer <your_secret>`
- **Simple**: Just include your webhook secret as a bearer token

## 🔧 **Environment Variables Setup**

Add these to your Vercel Project Settings → Environment Variables:

```bash
WEBHOOK_SECRET_SIGNALS="your-signals-webhook-secret-here"
WEBHOOK_SECRET_SATY_PHASE="your-saty-phase-webhook-secret-here" 
WEBHOOK_SECRET_TREND="your-trend-webhook-secret-here"
```

## 📋 **TradingView Setup Examples**

### Option 1: Using Bearer Token (Simplest)

**Webhook URL**: `https://optionstrat.vercel.app/api/webhooks/signals`

**Headers**:
```
Authorization: Bearer your-signals-webhook-secret-here
Content-Type: application/json
```

**Message**: Your JSON payload

### Option 2: Using HMAC Signature (Most Secure)

**Webhook URL**: `https://optionstrat.vercel.app/api/webhooks/signals`

**Headers**:
```
x-signature: sha256=<calculated_hmac_signature>
Content-Type: application/json
```

**Message**: Your JSON payload

## 🛡️ **Security Features**

- ✅ **Timing-safe comparison** prevents timing attacks
- ✅ **Multiple signature formats** supported for compatibility
- ✅ **Fallback authentication** methods
- ✅ **Detailed error messages** for debugging
- ✅ **Audit logging** of all authentication attempts
- ✅ **Development mode** bypasses auth if no secret configured

## 🔍 **Testing Authentication**

### Test with curl:

```bash
# Bearer token method
curl -X POST https://optionstrat.vercel.app/api/webhooks/signals \
  -H "Authorization: Bearer your-signals-webhook-secret-here" \
  -H "Content-Type: application/json" \
  -d '{"signal":{"type":"LONG","timeframe":"15",...}}'

# HMAC signature method (calculate signature first)
curl -X POST https://optionstrat.vercel.app/api/webhooks/signals \
  -H "x-signature: sha256=calculated_signature_here" \
  -H "Content-Type: application/json" \
  -d '{"signal":{"type":"LONG","timeframe":"15",...}}'
```

## 📊 **Monitoring**

- All authentication attempts are logged in the `webhook_receipts` table
- Check the **Webhooks** tab in your dashboard to monitor delivery status
- Failed authentication shows as 401 errors with detailed messages

## ⚠️ **Important Notes**

1. **Keep secrets secure**: Never commit secrets to git or share them publicly
2. **Use HTTPS only**: Webhook secrets should only be sent over HTTPS
3. **Rotate secrets regularly**: Change your webhook secrets periodically
4. **Monitor logs**: Check webhook receipts for failed authentication attempts
5. **Development mode**: If no secret is configured, authentication is bypassed (for development only)

## 🚨 **Troubleshooting**

### Common Issues:

1. **401 Unauthorized**: Check your secret is correct and properly formatted
2. **Invalid signature**: Ensure you're calculating HMAC-SHA256 correctly
3. **Missing headers**: Make sure Authorization or signature headers are included
4. **Wrong endpoint**: Verify you're using the correct webhook URL

### Debug Steps:

1. Check the **Webhooks** tab in your dashboard for error details
2. Verify environment variables are set in Vercel
3. Test with the simpler Bearer token method first
4. Use the webhook debug token to view detailed logs

Your webhooks are now secure! 🔒