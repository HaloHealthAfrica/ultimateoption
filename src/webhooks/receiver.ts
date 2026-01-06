/**
 * Webhook Receiver for EnrichedSignal
 * Parses and validates incoming TradingView webhooks
 * 
 * Requirements: 1.1, 1.4, 1.7
 */

import { z } from 'zod';
import {
  EnrichedSignal,
  EnrichedSignalSchema,
  WebhookPayloadSchema,
} from '@/types/signal';

/**
 * Result type for signal reception
 */
export interface SignalResult {
  success: boolean;
  signal?: EnrichedSignal;
  error?: {
    code: string;
    message: string;
    details?: z.ZodIssue[];
  };
}

/**
 * Error codes for webhook processing
 */
export const WebhookErrorCodes = {
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  INVALID_JSON: 'INVALID_JSON',
  SCHEMA_VALIDATION_FAILED: 'SCHEMA_VALIDATION_FAILED',
  MISSING_TEXT_FIELD: 'MISSING_TEXT_FIELD',
} as const;

/**
 * Parse and validate an EnrichedSignal from a webhook payload
 * 
 * @param payload - Raw webhook payload (should have { text: string } format)
 * @returns SignalResult with validated signal or descriptive error
 */
export function receiveSignal(payload: unknown): SignalResult {
  // Step 1: Validate webhook wrapper format
  const wrapperResult = WebhookPayloadSchema.safeParse(payload);
  
  if (!wrapperResult.success) {
    return {
      success: false,
      error: {
        code: WebhookErrorCodes.MISSING_TEXT_FIELD,
        message: 'Webhook payload must have a "text" field containing stringified JSON',
        details: wrapperResult.error.issues,
      },
    };
  }

  // Step 2: Parse JSON from text field
  let signalData: unknown;
  try {
    signalData = JSON.parse(wrapperResult.data.text);
  } catch (e) {
    return {
      success: false,
      error: {
        code: WebhookErrorCodes.INVALID_JSON,
        message: `Invalid JSON in text field: ${e instanceof Error ? e.message : 'Parse error'}`,
      },
    };
  }

  // Step 3: Validate against EnrichedSignal schema
  const signalResult = EnrichedSignalSchema.safeParse(signalData);
  
  if (!signalResult.success) {
    return {
      success: false,
      error: {
        code: WebhookErrorCodes.SCHEMA_VALIDATION_FAILED,
        message: formatValidationErrors(signalResult.error),
        details: signalResult.error.issues,
      },
    };
  }

  return {
    success: true,
    signal: signalResult.data,
  };
}

/**
 * Format Zod validation errors into a human-readable message
 */
function formatValidationErrors(error: z.ZodError): string {
  const issues = error.issues.map(issue => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });
  
  if (issues.length === 1) {
    return `Schema validation failed: ${issues[0]}`;
  }
  
  return `Schema validation failed with ${issues.length} errors: ${issues.slice(0, 3).join('; ')}${issues.length > 3 ? '...' : ''}`;
}

/**
 * Validate that a payload is a valid EnrichedSignal (without wrapper)
 * Useful for testing or direct validation
 */
export function validateSignal(data: unknown): SignalResult {
  const result = EnrichedSignalSchema.safeParse(data);
  
  if (!result.success) {
    return {
      success: false,
      error: {
        code: WebhookErrorCodes.SCHEMA_VALIDATION_FAILED,
        message: formatValidationErrors(result.error),
        details: result.error.issues,
      },
    };
  }

  return {
    success: true,
    signal: result.data,
  };
}
