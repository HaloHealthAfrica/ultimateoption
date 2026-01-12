/**
 * Durable webhook audit logging (Neon/Postgres)
 *
 * If DATABASE_URL is set, we insert a row per webhook receipt.
 * This avoids the "in-memory log is empty on another lambda instance" issue.
 */

import { Pool } from 'pg';
import type { WebhookAuditEntry, WebhookKind } from './auditLog';

declare global {
  // eslint-disable-next-line no-var
  var __webhookAuditPool: Pool | undefined;
}

function getPool(): Pool | null {
  const cs = process.env.DATABASE_URL;
  if (!cs) return null;
  if (!global.__webhookAuditPool) {
    global.__webhookAuditPool = new Pool({
      connectionString: cs,
      ssl: { rejectUnauthorized: false },
      max: 1,
    });
  }
  return global.__webhookAuditPool;
}

export async function recordWebhookReceipt(entry: Omit<WebhookAuditEntry, 'id' | 'received_at'>): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    // First, try inserting with the new columns
    await pool.query(
      `INSERT INTO webhook_receipts
        (kind, ok, status, ip, user_agent, ticker, symbol, timeframe, message, raw_payload, headers)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        entry.kind,
        entry.ok,
        entry.status,
        entry.ip ?? null,
        entry.user_agent ?? null,
        entry.ticker ?? null,
        entry.symbol ?? null,
        entry.timeframe ?? null,
        entry.message ?? null,
        entry.raw_payload ?? null,
        entry.headers ? JSON.stringify(entry.headers) : null,
      ]
    );
  } catch (error) {
    // If the new columns don't exist, fall back to the old insert
    console.warn('Failed to insert with new columns, falling back to legacy insert:', error);
    
    try {
      await pool.query(
        `INSERT INTO webhook_receipts
          (kind, ok, status, ip, user_agent, ticker, symbol, timeframe, message)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          entry.kind,
          entry.ok,
          entry.status,
          entry.ip ?? null,
          entry.user_agent ?? null,
          entry.ticker ?? null,
          entry.symbol ?? null,
          entry.timeframe ?? null,
          entry.message ?? null,
        ]
      );
    } catch (legacyError) {
      // Never break webhook handling if logging fails.
      console.error('Failed to record webhook receipt:', legacyError);
    }
  }
}

export async function listWebhookReceipts(limit: number): Promise<WebhookAuditEntry[] | null> {
  const pool = getPool();
  if (!pool) return null;

  const lim = Math.max(1, Math.min(200, limit));
  
  try {
    // First, try the new query with raw_payload and headers
    const res = await pool.query(
      `SELECT
         id::text as id,
         extract(epoch from received_at) * 1000 as received_at,
         kind,
         ok,
         status,
         ip,
         user_agent,
         ticker,
         symbol,
         timeframe,
         message,
         raw_payload,
         headers
       FROM webhook_receipts
       ORDER BY received_at DESC
       LIMIT $1`,
      [lim]
    );

    type Row = {
      id: string;
      received_at: number;
      kind: WebhookKind;
      ok: boolean;
      status: number;
      ip: string | null;
      user_agent: string | null;
      ticker: string | null;
      symbol: string | null;
      timeframe: string | null;
      message: string | null;
      raw_payload: string | null;
      headers: string | null;
    };

    return (res.rows as Row[]).map((r) => ({
      id: String(r.id),
      received_at: Math.trunc(Number(r.received_at)),
      kind: r.kind as WebhookKind,
      ok: Boolean(r.ok),
      status: Number(r.status),
      ip: r.ip ?? undefined,
      user_agent: r.user_agent ?? undefined,
      ticker: r.ticker ?? undefined,
      symbol: r.symbol ?? undefined,
      timeframe: r.timeframe ?? undefined,
      message: r.message ?? undefined,
      raw_payload: r.raw_payload ?? undefined,
      headers: r.headers ? JSON.parse(r.headers) : undefined,
    }));
  } catch (error) {
    // If the new columns don't exist, fall back to the old query
    console.warn('Failed to query with new columns, falling back to legacy query:', error);
    
    try {
      const res = await pool.query(
        `SELECT
           id::text as id,
           extract(epoch from received_at) * 1000 as received_at,
           kind,
           ok,
           status,
           ip,
           user_agent,
           ticker,
           symbol,
           timeframe,
           message
         FROM webhook_receipts
         ORDER BY received_at DESC
         LIMIT $1`,
        [lim]
      );

      type LegacyRow = {
        id: string;
        received_at: number;
        kind: WebhookKind;
        ok: boolean;
        status: number;
        ip: string | null;
        user_agent: string | null;
        ticker: string | null;
        symbol: string | null;
        timeframe: string | null;
        message: string | null;
      };

      return (res.rows as LegacyRow[]).map((r) => ({
        id: String(r.id),
        received_at: Math.trunc(Number(r.received_at)),
        kind: r.kind as WebhookKind,
        ok: Boolean(r.ok),
        status: Number(r.status),
        ip: r.ip ?? undefined,
        user_agent: r.user_agent ?? undefined,
        ticker: r.ticker ?? undefined,
        symbol: r.symbol ?? undefined,
        timeframe: r.timeframe ?? undefined,
        message: r.message ?? undefined,
      }));
    } catch (legacyError) {
      console.error('Failed to query webhook receipts:', legacyError);
      return null;
    }
  }
}


