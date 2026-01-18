/**
 * Webhook Traces API
 * 
 * Provides detailed tracking information for webhook processing pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { WebhookAuditLog } from '@/webhooks/auditLog';

interface WebhookTrace {
  id: string;
  timestamp: number;
  kind: string;
  symbol: string;
  status: 'success' | 'error' | 'processing';
  stages: {
    ingestion: StageInfo;
    routing: StageInfo;
    normalization: StageInfo;
    contextUpdate: StageInfo;
    decisionMaking: StageInfo;
    ledgerStorage: StageInfo;
    dashboardDisplay: StageInfo;
  };
  rawPayload?: unknown;
  decision?: unknown;
  errors?: string[];
}

interface StageInfo {
  status: 'pending' | 'success' | 'error' | 'skipped';
  timestamp?: number;
  duration?: number;
  message?: string;
  data?: unknown;
}

/**
 * GET /api/webhooks/traces
 * 
 * Returns webhook processing traces with detailed pipeline information
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    
    // Get recent webhook receipts from audit log
    const audit = WebhookAuditLog.getInstance();
    const receipts = audit.getRecent(limit);
    
    // Build traces from receipts
    const traces: WebhookTrace[] = receipts.map(receipt => {
      const isSuccess = receipt.ok && receipt.status === 200;
      const hasError = !receipt.ok || receipt.status >= 400;
      
      // Parse message for stage information
      const message = receipt.message || '';
      const isWaiting = message.includes('waiting for complete context');
      const isDecisionMade = message.includes('Decision made');
      const hasLedgerStored = message.includes('ledgerStored":true') || message.includes('Ledger stored: true');
      const hasLedgerError = message.includes('ledgerStored":false') || message.includes('ledgerError');
      
      // Extract decision info from message
      let decisionAction = null;
      let decisionConfidence = null;
      const decisionMatch = message.match(/Decision made: (\w+) \(confidence: ([\d.]+)\)/);
      if (decisionMatch) {
        decisionAction = decisionMatch[1];
        decisionConfidence = parseFloat(decisionMatch[2]);
      }
      
      // Build stage information
      const stages: WebhookTrace['stages'] = {
        ingestion: {
          status: 'success',
          timestamp: receipt.received_at,
          message: `Received ${receipt.kind} webhook`,
          data: { ip: receipt.ip, userAgent: receipt.user_agent }
        },
        routing: {
          status: isSuccess ? 'success' : 'error',
          message: isSuccess ? 'Webhook routed successfully' : 'Routing failed',
        },
        normalization: {
          status: isSuccess ? 'success' : 'error',
          message: isSuccess ? 'Payload normalized' : 'Normalization failed',
        },
        contextUpdate: {
          status: isSuccess ? 'success' : 'error',
          message: isWaiting ? 'Context updated, waiting for more data' : 'Context updated',
        },
        decisionMaking: {
          status: isDecisionMade ? 'success' : isWaiting ? 'pending' : hasError ? 'error' : 'skipped',
          message: isDecisionMade ? `Decision: ${decisionAction}` : isWaiting ? 'Waiting for complete context' : 'No decision made',
          data: decisionAction ? {
            action: decisionAction,
            confidence: decisionConfidence
          } : undefined
        },
        ledgerStorage: {
          status: hasLedgerStored ? 'success' : hasLedgerError ? 'error' : isWaiting ? 'pending' : 'skipped',
          message: hasLedgerStored ? 'Stored in ledger' : hasLedgerError ? 'Ledger storage failed' : 'Not stored',
        },
        dashboardDisplay: {
          status: hasLedgerStored ? 'success' : 'pending',
          message: hasLedgerStored ? 'Available on dashboard' : 'Not yet displayed',
        }
      };
      
      // Extract errors
      const errors: string[] = [];
      if (hasError) {
        errors.push(message);
      }
      if (hasLedgerError) {
        const ledgerErrorMatch = message.match(/ledgerError['":]+"([^"]+)"/);
        if (ledgerErrorMatch) {
          errors.push(`Ledger: ${ledgerErrorMatch[1]}`);
        }
      }
      
      // Try to parse raw payload
      let rawPayload = undefined;
      if (receipt.raw_payload) {
        try {
          rawPayload = JSON.parse(receipt.raw_payload);
        } catch {
          rawPayload = receipt.raw_payload;
        }
      }
      
      return {
        id: `${receipt.received_at}-${receipt.ticker || receipt.symbol || 'unknown'}`,
        timestamp: receipt.received_at,
        kind: receipt.kind,
        symbol: receipt.ticker || receipt.symbol || 'Unknown',
        status: isSuccess && hasLedgerStored ? 'success' : hasError ? 'error' : 'processing',
        stages,
        rawPayload,
        decision: decisionAction ? {
          action: decisionAction,
          confidence: decisionConfidence
        } : undefined,
        errors: errors.length > 0 ? errors : undefined
      };
    });
    
    return NextResponse.json({
      success: true,
      traces,
      count: traces.length,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Failed to fetch webhook traces:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch traces',
      traces: [],
      count: 0
    }, { status: 500 });
  }
}

