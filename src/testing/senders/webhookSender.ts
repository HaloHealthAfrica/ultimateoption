/**
 * Webhook Sender
 * 
 * Sends test webhooks to configurable endpoints.
 * Returns status, latency, and response data.
 * 
 * Requirements: 19.4, 19.5
 */

import { EnrichedSignal } from '../../types/signal';
import { SatyPhaseWebhook } from '../../types/saty';
import { TrendWebhookPayload } from '../generators/trendGenerator';
import { wrapAsWebhookPayload } from '../generators/signalGenerator';
import { wrapPhaseAsWebhookPayload } from '../generators/phaseGenerator';

/**
 * Webhook send result
 */
export interface WebhookSendResult {
  success: boolean;
  status: number;
  latency_ms: number;
  response?: unknown;
  error?: string;
  sent_at: number;
}

/**
 * Batch send result
 */
export interface BatchSendResult {
  total: number;
  successful: number;
  failed: number;
  results: WebhookSendResult[];
  avg_latency_ms: number;
}

/**
 * Webhook sender configuration
 */
export interface WebhookSenderConfig {
  signalEndpoint: string;
  phaseEndpoint: string;
  trendEndpoint: string;
  timeout_ms?: number;
  headers?: Record<string, string>;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: WebhookSenderConfig = {
  signalEndpoint: 'http://localhost:3000/api/webhooks/signals',
  phaseEndpoint: 'http://localhost:3000/api/webhooks/saty-phase',
  trendEndpoint: 'http://localhost:3000/api/webhooks/trend',
  timeout_ms: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * Send a signal webhook
 * Requirement 19.4
 * 
 * @param signal - EnrichedSignal to send
 * @param config - Sender configuration
 * @returns Send result
 */
export async function sendSignalWebhook(
  signal: EnrichedSignal,
  config: Partial<WebhookSenderConfig> = {}
): Promise<WebhookSendResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const payload = wrapAsWebhookPayload(signal);
  
  return sendWebhook(cfg.signalEndpoint, payload, cfg);
}

/**
 * Send a phase webhook
 * Requirement 19.4
 * 
 * @param phase - SatyPhaseWebhook to send
 * @param config - Sender configuration
 * @returns Send result
 */
export async function sendPhaseWebhook(
  phase: SatyPhaseWebhook,
  config: Partial<WebhookSenderConfig> = {}
): Promise<WebhookSendResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const payload = wrapPhaseAsWebhookPayload(phase);
  
  return sendWebhook(cfg.phaseEndpoint, payload, cfg);
}

/**
 * Send a trend webhook
 * Requirement 19.4
 * 
 * @param trend - TrendWebhookPayload to send
 * @param config - Sender configuration
 * @returns Send result
 */
export async function sendTrendWebhook(
  trend: TrendWebhookPayload,
  config: Partial<WebhookSenderConfig> = {}
): Promise<WebhookSendResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  return sendWebhook(cfg.trendEndpoint, trend, cfg);
}

/**
 * Send a webhook to an endpoint
 * 
 * @param endpoint - URL to send to
 * @param payload - Payload to send
 * @param config - Sender configuration
 * @returns Send result
 */
async function sendWebhook(
  endpoint: string,
  payload: unknown,
  config: WebhookSenderConfig
): Promise<WebhookSendResult> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout_ms || 5000);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: config.headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const latency = Date.now() - startTime;
    let responseData: unknown;
    
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
    
    return {
      success: response.ok,
      status: response.status,
      latency_ms: latency,
      response: responseData,
      sent_at: startTime,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      latency_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      sent_at: startTime,
    };
  }
}

/**
 * Send multiple signal webhooks in batch
 * Requirement 19.5
 * 
 * @param signals - Array of signals to send
 * @param config - Sender configuration
 * @param delay_ms - Delay between sends (default 0)
 * @returns Batch send result
 */
export async function sendSignalBatch(
  signals: EnrichedSignal[],
  config: Partial<WebhookSenderConfig> = {},
  delay_ms: number = 0
): Promise<BatchSendResult> {
  const results: WebhookSendResult[] = [];
  
  for (const signal of signals) {
    const result = await sendSignalWebhook(signal, config);
    results.push(result);
    
    if (delay_ms > 0) {
      await sleep(delay_ms);
    }
  }
  
  return summarizeBatchResults(results);
}

/**
 * Send multiple phase webhooks in batch
 * 
 * @param phases - Array of phases to send
 * @param config - Sender configuration
 * @param delay_ms - Delay between sends (default 0)
 * @returns Batch send result
 */
export async function sendPhaseBatch(
  phases: SatyPhaseWebhook[],
  config: Partial<WebhookSenderConfig> = {},
  delay_ms: number = 0
): Promise<BatchSendResult> {
  const results: WebhookSendResult[] = [];
  
  for (const phase of phases) {
    const result = await sendPhaseWebhook(phase, config);
    results.push(result);
    
    if (delay_ms > 0) {
      await sleep(delay_ms);
    }
  }
  
  return summarizeBatchResults(results);
}

/**
 * Send multiple trend webhooks in batch
 * 
 * @param trends - Array of trends to send
 * @param config - Sender configuration
 * @param delay_ms - Delay between sends (default 0)
 * @returns Batch send result
 */
export async function sendTrendBatch(
  trends: TrendWebhookPayload[],
  config: Partial<WebhookSenderConfig> = {},
  delay_ms: number = 0
): Promise<BatchSendResult> {
  const results: WebhookSendResult[] = [];
  
  for (const trend of trends) {
    const result = await sendTrendWebhook(trend, config);
    results.push(result);
    
    if (delay_ms > 0) {
      await sleep(delay_ms);
    }
  }
  
  return summarizeBatchResults(results);
}

/**
 * Mixed webhook item for batch sending
 */
export type MixedWebhookItem = 
  | { type: 'signal'; data: EnrichedSignal }
  | { type: 'phase'; data: SatyPhaseWebhook }
  | { type: 'trend'; data: TrendWebhookPayload };

/**
 * Send mixed webhook types in batch
 * Requirement 19.5 - Support batch sending of mixed webhook types
 * 
 * @param items - Array of mixed webhook items
 * @param config - Sender configuration
 * @param delay_ms - Delay between sends (default 0)
 * @returns Batch send result
 */
export async function sendMixedBatch(
  items: MixedWebhookItem[],
  config: Partial<WebhookSenderConfig> = {},
  delay_ms: number = 0
): Promise<BatchSendResult> {
  const results: WebhookSendResult[] = [];
  
  for (const item of items) {
    let result: WebhookSendResult;
    
    switch (item.type) {
      case 'signal':
        result = await sendSignalWebhook(item.data, config);
        break;
      case 'phase':
        result = await sendPhaseWebhook(item.data, config);
        break;
      case 'trend':
        result = await sendTrendWebhook(item.data, config);
        break;
      default:
        // TypeScript exhaustiveness check
        const _exhaustive: never = item;
        throw new Error(`Unknown webhook type: ${_exhaustive}`);
    }
    
    results.push(result);
    
    if (delay_ms > 0) {
      await sleep(delay_ms);
    }
  }
  
  return summarizeBatchResults(results);
}

/**
 * Summarize batch results
 */
function summarizeBatchResults(results: WebhookSendResult[]): BatchSendResult {
  const successful = results.filter(r => r.success).length;
  const totalLatency = results.reduce((sum, r) => sum + r.latency_ms, 0);
  
  return {
    total: results.length,
    successful,
    failed: results.length - successful,
    results,
    avg_latency_ms: results.length > 0 ? totalLatency / results.length : 0,
  };
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a configured webhook sender
 * 
 * @param config - Sender configuration
 * @returns Configured sender functions
 */
export function createWebhookSender(config: Partial<WebhookSenderConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  return {
    sendSignal: (signal: EnrichedSignal) => sendSignalWebhook(signal, cfg),
    sendPhase: (phase: SatyPhaseWebhook) => sendPhaseWebhook(phase, cfg),
    sendTrend: (trend: TrendWebhookPayload) => sendTrendWebhook(trend, cfg),
    sendSignalBatch: (signals: EnrichedSignal[], delay_ms?: number) => 
      sendSignalBatch(signals, cfg, delay_ms),
    sendPhaseBatch: (phases: SatyPhaseWebhook[], delay_ms?: number) => 
      sendPhaseBatch(phases, cfg, delay_ms),
    sendTrendBatch: (trends: TrendWebhookPayload[], delay_ms?: number) => 
      sendTrendBatch(trends, cfg, delay_ms),
    sendMixedBatch: (items: MixedWebhookItem[], delay_ms?: number) => 
      sendMixedBatch(items, cfg, delay_ms),
  };
}
