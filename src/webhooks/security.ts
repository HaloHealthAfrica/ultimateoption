/**
 * Webhook Security Utilities
 * 
 * Validates webhook secrets for TradingView and other webhook sources
 */

import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

export type WebhookType = 'signals' | 'saty-phase' | 'trend';

/**
 * Get the expected webhook secret for a given webhook type
 */
function getWebhookSecret(type: WebhookType): string | null {
  const secretMap = {
    'signals': process.env.WEBHOOK_SECRET_SIGNALS,
    'saty-phase': process.env.WEBHOOK_SECRET_SATY_PHASE,
    'trend': process.env.WEBHOOK_SECRET_TREND,
  };
  
  return secretMap[type] || null;
}

/**
 * Validate webhook signature using HMAC-SHA256
 * Supports both GitHub-style and custom signature formats
 */
export function validateWebhookSignature(
  request: NextRequest,
  body: string,
  webhookType: WebhookType
): { valid: boolean; error?: string } {
  const secret = getWebhookSecret(webhookType);
  
  if (!secret) {
    return { valid: false, error: `No secret configured for ${webhookType} webhook` };
  }
  
  // Check for signature in headers (multiple formats supported)
  const signature = 
    request.headers.get('x-hub-signature-256') ||  // GitHub style
    request.headers.get('x-signature') ||          // Custom style
    request.headers.get('signature');              // Simple style
  
  if (!signature) {
    return { valid: false, error: 'No signature provided' };
  }
  
  try {
    // Generate expected signature
    const expectedSignature = createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('hex');
    
    // Handle different signature formats
    let providedSignature = signature;
    if (signature.startsWith('sha256=')) {
      providedSignature = signature.slice(7); // Remove 'sha256=' prefix
    }
    
    // Use timing-safe comparison
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const providedBuffer = Buffer.from(providedSignature, 'hex');
    
    if (expectedBuffer.length !== providedBuffer.length) {
      return { valid: false, error: 'Invalid signature format' };
    }
    
    const isValid = timingSafeEqual(expectedBuffer, providedBuffer);
    
    return { valid: isValid, error: isValid ? undefined : 'Invalid signature' };
  } catch (error) {
    return { 
      valid: false, 
      error: `Signature validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Validate simple bearer token authentication
 * Alternative to HMAC signatures for simpler setups
 */
export function validateBearerToken(
  request: NextRequest,
  webhookType: WebhookType
): { valid: boolean; error?: string } {
  const secret = getWebhookSecret(webhookType);
  
  if (!secret) {
    return { valid: false, error: `No secret configured for ${webhookType} webhook` };
  }
  
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return { valid: false, error: 'No authorization header provided' };
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Invalid authorization format. Use: Bearer <token>' };
  }
  
  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
  
  // Use timing-safe comparison
  try {
    const expectedBuffer = Buffer.from(secret, 'utf8');
    const providedBuffer = Buffer.from(token, 'utf8');
    
    if (expectedBuffer.length !== providedBuffer.length) {
      return { valid: false, error: 'Invalid token' };
    }
    
    const isValid = timingSafeEqual(expectedBuffer, providedBuffer);
    
    return { valid: isValid, error: isValid ? undefined : 'Invalid token' };
  } catch (error) {
    return { 
      valid: false, 
      error: `Token validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Validate query parameter authentication
 * Alternative for systems that can't set custom headers
 */
export function validateQueryParameter(
  request: NextRequest,
  webhookType: WebhookType
): { valid: boolean; error?: string } {
  const secret = getWebhookSecret(webhookType);
  
  if (!secret) {
    return { valid: false, error: `No secret configured for ${webhookType} webhook` };
  }
  
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key') || searchParams.get('secret') || searchParams.get('token');
  
  if (!key) {
    return { valid: false, error: 'No key parameter provided. Use ?key=<your_secret>' };
  }
  
  // Use timing-safe comparison
  try {
    const expectedBuffer = Buffer.from(secret, 'utf8');
    const providedBuffer = Buffer.from(key, 'utf8');
    
    if (expectedBuffer.length !== providedBuffer.length) {
      return { valid: false, error: 'Invalid key' };
    }
    
    const isValid = timingSafeEqual(expectedBuffer, providedBuffer);
    
    return { valid: isValid, error: isValid ? undefined : 'Invalid key' };
  } catch (error) {
    return { 
      valid: false, 
      error: `Key validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}
/**
 * Comprehensive webhook authentication
 * Tries multiple authentication methods in order of preference
 */
export function authenticateWebhook(
  request: NextRequest,
  body: string,
  webhookType: WebhookType
): { authenticated: boolean; method?: string; error?: string } {
  // Method 1: Try query parameter validation (most common for indicators)
  const queryResult = validateQueryParameter(request, webhookType);
  if (queryResult.valid) {
    return { authenticated: true, method: 'query-parameter' };
  }
  
  // Method 2: Try HMAC signature validation
  const signatureResult = validateWebhookSignature(request, body, webhookType);
  if (signatureResult.valid) {
    return { authenticated: true, method: 'hmac-signature' };
  }
  
  // Method 3: Try Bearer token validation
  const tokenResult = validateBearerToken(request, webhookType);
  if (tokenResult.valid) {
    return { authenticated: true, method: 'bearer-token' };
  }
  
  // If no secret is configured, allow through (for development)
  const secret = getWebhookSecret(webhookType);
  if (!secret) {
    return { 
      authenticated: true, 
      method: 'no-auth-configured',
      error: 'Warning: No webhook secret configured - authentication bypassed'
    };
  }
  
  // All methods failed
  return { 
    authenticated: false, 
    error: `Authentication failed. Tried: query (?key=${queryResult.error}), signature (${signatureResult.error}), token (${tokenResult.error})` 
  };
}