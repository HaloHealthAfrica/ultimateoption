# Phase 2.5 Webhook Sequence Diagrams

These diagrams show the end-to-end flow for each webhook endpoint.

## 1) Phase 2.5 SATY Phase
```mermaid
sequenceDiagram
  autonumber
  participant TV as TradingView/SATY
  participant API as /api/phase25/webhooks/saty-phase
  participant Orchestrator as DecisionOrchestratorService
  participant Router as SourceRouterService
  participant Normalizer as NormalizerService
  participant Store as ContextStoreService
  participant Market as MarketContextBuilder
  participant Engine as DecisionEngineService
  participant Ledger as GlobalLedger (Postgres)
  participant Audit as WebhookAuditLog
  participant DB as auditDb/ledger_entries

  TV->>API: POST SATY payload (JSON or text wrapper)
  API->>Audit: log receipt (ok/error)
  API->>Orchestrator: processWebhook(body)
  Orchestrator->>Router: routeWebhook(payload)
  Router->>Normalizer: detectSource + normalize
  Normalizer-->>Router: NormalizedPayload
  Router-->>Orchestrator: normalized + source
  Orchestrator->>Store: update(partial)
  alt context incomplete
    Orchestrator-->>API: success + waiting message
  else context complete
    Orchestrator->>Market: buildContext(symbol)
    Orchestrator->>Engine: makeDecision(context, market)
    Orchestrator->>Ledger: append(ledgerEntry)
    Ledger->>DB: INSERT ledger_entries
    Orchestrator-->>API: decision result
  end
  API-->>TV: JSON response
```

## 2) Phase 2.5 Signals
```mermaid
sequenceDiagram
  autonumber
  participant TV as TradingView Signals
  participant API as /api/phase25/webhooks/signals
  participant Orchestrator as DecisionOrchestratorService
  participant Router as SourceRouterService
  participant Normalizer as NormalizerService
  participant Store as ContextStoreService
  participant Market as MarketContextBuilder
  participant Engine as DecisionEngineService
  participant Ledger as GlobalLedger (Postgres)
  participant Audit as WebhookAuditLog
  participant DB as auditDb/ledger_entries

  TV->>API: POST signal payload
  API->>Audit: log receipt (ok/error)
  API->>Orchestrator: processWebhook(body)
  Orchestrator->>Router: routeWebhook(payload)
  Router->>Normalizer: detectSource + normalize
  Normalizer-->>Router: NormalizedPayload
  Router-->>Orchestrator: normalized + source
  Orchestrator->>Store: update(partial)
  alt context incomplete
    Orchestrator-->>API: success + waiting message
  else context complete
    Orchestrator->>Market: buildContext(symbol)
    Orchestrator->>Engine: makeDecision(context, market)
    Orchestrator->>Ledger: append(ledgerEntry)
    Ledger->>DB: INSERT ledger_entries
    Orchestrator-->>API: decision result
  end
  API-->>TV: JSON response
```

## 3) Core SATY Phase (non‑Phase2.5)
```mermaid
sequenceDiagram
  autonumber
  participant TV as TradingView/SATY
  participant API as /api/webhooks/saty-phase
  participant Auth as authenticateWebhook
  participant Store as PhaseStore
  participant Bus as executionPublisher
  participant Audit as WebhookAuditLog
  participant DB as auditDb

  TV->>API: POST SATY payload (JSON/text wrapper)
  API->>Auth: validate optional auth
  API->>Store: updatePhase(phase)
  API->>Bus: phaseReceived(...)
  API->>Audit: log receipt
  API->>DB: recordWebhookReceipt
  API-->>TV: success response (decay + metadata)
```

## 4) Core Signals (Phase 2 engine)
```mermaid
sequenceDiagram
  autonumber
  participant TV as TradingView Signals
  participant API as /api/webhooks/signals
  participant Normalizer as phase2 Normalizer
  participant Market as MarketContextBuilder
  participant Engine as Phase2 DecisionEngine
  participant Audit as WebhookAuditLog
  participant DB as auditDb

  TV->>API: POST signal payload
  API->>Normalizer: normalizeSignal(body)
  API->>Market: buildMarketContext(symbol)
  API->>Engine: makeDecision(context + market)
  API->>Audit: log receipt
  API->>DB: recordWebhookReceipt
  API-->>TV: decision output
```

## 5) Trend Webhook
```mermaid
sequenceDiagram
  autonumber
  participant TV as TradingView Trend
  participant API as /api/webhooks/trend
  participant Auth as authenticateWebhook
  participant Adapter as parseAndAdaptTrend
  participant Store as TrendStore
  participant Audit as WebhookAuditLog
  participant DB as auditDb

  TV->>API: POST trend payload (multiple formats)
  API->>Auth: validate optional auth
  API->>Adapter: parse/normalize trend
  API->>Store: updateTrend(trend)
  API->>Audit: log receipt
  API->>DB: recordWebhookReceipt
  API-->>TV: alignment + storage info
```
