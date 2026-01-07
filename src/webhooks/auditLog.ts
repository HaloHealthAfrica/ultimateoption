/**
 * Webhook Audit Log (in-memory ring buffer)
 *
 * Purpose:
 * - Let us confirm whether TradingView webhooks hit the app on Vercel.
 * - Store only a small, redacted summary (no raw payload) to avoid leaking data.
 *
 * NOTE: This is in-memory and may reset on redeploy / cold starts.
 */

export type WebhookKind = 'signals' | 'trend' | 'saty-phase';

export interface WebhookAuditEntry {
  id: string;
  kind: WebhookKind;
  received_at: number;
  ok: boolean;
  status: number;
  ip?: string;
  user_agent?: string;
  // Minimal identifiers (best-effort, may be absent on invalid payloads)
  ticker?: string;
  symbol?: string;
  timeframe?: string;
  message?: string;
}

function makeId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export class WebhookAuditLog {
  private static instance: WebhookAuditLog | null = null;
  private readonly maxEntries: number;
  private entries: WebhookAuditEntry[] = [];

  private constructor(maxEntries: number = 200) {
    this.maxEntries = maxEntries;
  }

  static getInstance(): WebhookAuditLog {
    if (!WebhookAuditLog.instance) {
      WebhookAuditLog.instance = new WebhookAuditLog();
    }
    return WebhookAuditLog.instance;
  }

  add(entry: Omit<WebhookAuditEntry, 'id' | 'received_at'>): WebhookAuditEntry {
    const full: WebhookAuditEntry = {
      id: makeId(),
      received_at: Date.now(),
      ...entry,
    };
    this.entries.unshift(full);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }
    return full;
  }

  list(limit: number = 50): WebhookAuditEntry[] {
    return this.entries.slice(0, Math.max(0, Math.min(200, limit)));
  }

  clear(): void {
    this.entries = [];
  }
}


