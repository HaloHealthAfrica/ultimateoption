/**
 * Webhook Receiver for SatyPhaseWebhook
 * Parses and validates incoming SATY Phase Oscillator events
 * 
 * Requirements: 18.1, 18.2, 18.8
 */

import { z } from 'zod';
import {
  SatyPhaseWebhook,
  SatyPhaseWebhookSchema,
} from '@/types/saty';

/**
 * Result type for phase reception
 */
export interface PhaseResult {
  success: boolean;
  phase?: SatyPhaseWebhook;
  error?: {
    code: string;
    message: string;
    details?: z.ZodIssue[];
  };
}

/**
 * Error codes for phase webhook processing
 */
export const PhaseWebhookErrorCodes = {
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  INVALID_JSON: 'INVALID_JSON',
  SCHEMA_VALIDATION_FAILED: 'SCHEMA_VALIDATION_FAILED',
  MISSING_TEXT_FIELD: 'MISSING_TEXT_FIELD',
  INVALID_ENGINE: 'INVALID_ENGINE',
} as const;

// Webhook payload wrapper schema
const WebhookPayloadSchema = z.object({
  text: z.string(),
});

/**
 * Parse and validate a SatyPhaseWebhook from a webhook payload
 * 
 * @param payload - Raw webhook payload (should have { text: string } format)
 * @returns PhaseResult with validated phase or descriptive error
 */
export function receivePhase(payload: unknown): PhaseResult {
  // Step 1: Validate webhook wrapper format
  const wrapperResult = WebhookPayloadSchema.safeParse(payload);
  
  if (!wrapperResult.success) {
    return {
      success: false,
      error: {
        code: PhaseWebhookErrorCodes.MISSING_TEXT_FIELD,
        message: 'Webhook payload must have a "text" field containing stringified JSON',
        details: wrapperResult.error.issues,
      },
    };
  }

  // Step 2: Parse JSON from text field
  let phaseData: unknown;
  try {
    phaseData = JSON.parse(wrapperResult.data.text);
  } catch (e) {
    return {
      success: false,
      error: {
        code: PhaseWebhookErrorCodes.INVALID_JSON,
        message: `Invalid JSON in text field: ${e instanceof Error ? e.message : 'Parse error'}`,
      },
    };
  }

  // Step 3: Validate against SatyPhaseWebhook schema
  const phaseResult = SatyPhaseWebhookSchema.safeParse(phaseData);
  
  if (!phaseResult.success) {
    return {
      success: false,
      error: {
        code: PhaseWebhookErrorCodes.SCHEMA_VALIDATION_FAILED,
        message: formatValidationErrors(phaseResult.error),
        details: phaseResult.error.issues,
      },
    };
  }

  // Step 4: Verify engine is SATY_PO (already enforced by schema, but explicit check)
  if (phaseResult.data.meta.engine !== 'SATY_PO') {
    return {
      success: false,
      error: {
        code: PhaseWebhookErrorCodes.INVALID_ENGINE,
        message: `Invalid engine: expected "SATY_PO", got "${phaseResult.data.meta.engine}"`,
      },
    };
  }

  return {
    success: true,
    phase: phaseResult.data,
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
 * Validate that a payload is a valid SatyPhaseWebhook (without wrapper)
 * Useful for testing or direct validation
 */
export function validatePhase(data: unknown): PhaseResult {
  const result = SatyPhaseWebhookSchema.safeParse(data);
  
  if (!result.success) {
    return {
      success: false,
      error: {
        code: PhaseWebhookErrorCodes.SCHEMA_VALIDATION_FAILED,
        message: formatValidationErrors(result.error),
        details: result.error.issues,
      },
    };
  }

  return {
    success: true,
    phase: result.data,
  };
}
