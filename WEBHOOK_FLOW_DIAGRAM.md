# Webhook Processing Flow Diagrams

## 1. Signals Webhook Flow

```mermaid
graph TD
    A[TradingView Alert] -->|HTTP POST| B[/api/webhooks/signals]
    B --> C{Authentication}
    C -->|Optional| D[Capture Headers & Body]
    D --> E{JSON Valid?}
    E -->|No| F[HTTP 400: Invalid JSON]
    E -->|Yes| G[Normalizer.normalizeSignal]
    
    G --> H{Validation}
    H -->|Fail| I[HTTP 400: Validation Error]
    H -->|Pass| J[MarketContextBuilder]
    
    J --> K[Fetch Tradier Data]
    J --> L[Fetch TwelveData]
    J --> M[Fetch Alpaca Data]
    
    K --> N[Merge Market Context]
    L --> N
    M --> N
    
    N --> O[DecisionEngine.makeDecision]
    
    O --> P[Evaluate SPREAD_GATE]
    P --> Q[Evaluate VOLATILITY_GATE]
    Q --> R[Evaluate GAMMA_GATE]
    R --> S[Evaluate PHASE_GATE]
    S --> T[Evaluate SESSION_GATE]
    
    T --> U{All Gates Pass?}
    U -->|Yes| V[Decision: ACCEPT]
    U -->|No| W[Decision: REJECT]
    
    V --> X[Calculate Confidence]
    X --> Y[Build Audit Trail]
    W --> Z[Collect Rejection Reasons]
    Z --> Y
    
    Y --> AA[recordWebhookReceipt]
    Y --> AB[WebhookAuditLog.add]
    Y --> AC[eventBus.publish DECISION_MADE]
    Y --> AD[HTTP 200: DecisionOutput]
    
    AA --> AE[(Database)]
    AB --> AF[(In-Memory Log)]
    AC --> AG[Event Bus]
    AG --> AH[Learning Modules Subscribe]
```

## 2. SATY Phase Webhook Flow

```mermaid
graph TD
    A[TradingView Alert] -->|HTTP POST| B[/api/webhooks/saty-phase]
    B --> C{Authentication}
    C -->|Optional| D[Capture Headers & Body]
    
    D --> E{Contains 'Trend Change:'?}
    E -->|Yes| F[HTTP 400: Wrong Endpoint]
    E -->|No| G{Has 'timeframes' field?}
    G -->|Yes| H[HTTP 400: Wrong Endpoint]
    G -->|No| I[Try Parse: Text-Wrapped]
    
    I --> J{Success?}
    J -->|No| K[Try Parse: Direct SATY]
    J -->|Yes| M[Phase Validated]
    
    K --> L{Success?}
    L -->|No| N[Try Parse: Flexible Adapter]
    L -->|Yes| M
    
    N --> O{Success?}
    O -->|No| P[HTTP 400: Invalid Payload]
    O -->|Yes| M
    
    M --> Q[Calculate Decay Time]
    Q --> R[PhaseStore.updatePhase]
    
    R --> S[Store with TTL]
    S --> T[Key: symbol:timeframe]
    T --> U[Cleanup Expired Phases]
    
    U --> V[PhaseStore.getRegimeContext]
    V --> W[Aggregate 15M/1H/4H/1D]
    W --> X[Calculate Alignment]
    
    X --> Y[executionPublisher.phaseReceived]
    Y --> Z[recordWebhookReceipt]
    Z --> AA[WebhookAuditLog.add]
    AA --> AB[HTTP 200: Success Response]
    
    Y --> AC[Event Bus]
    AC --> AD[Learning Modules Subscribe]
    Z --> AE[(Database)]
    AA --> AF[(In-Memory Log)]
```

## 3. Trend Webhook Flow

```mermaid
graph TD
    A[TradingView Alert] -->|HTTP POST| B[/api/webhooks/trend]
    B --> C{Authentication}
    C -->|Optional| D[Capture Headers & Body]
    
    D --> E{Has 'text' field?}
    E -->|Yes| F[Try Parse: Legacy Wrapper]
    E -->|No| G[Try Parse: TradingView Format]
    
    F --> H{Success?}
    H -->|No| I[HTTP 400: Invalid Payload]
    H -->|Yes| J[Trend Validated]
    
    G --> K{Success?}
    K -->|No| L[Try Parse: Canonical Format]
    K -->|Yes| J
    
    L --> M{Success?}
    M -->|No| I
    M -->|Yes| J
    
    J --> N[TrendStore.updateTrend]
    N --> O[Store with 1-hour TTL]
    O --> P[Key: ticker]
    P --> Q[Cleanup Expired Trends]
    
    Q --> R[calculateTrendAlignment]
    R --> S[Count Bullish/Bearish/Neutral]
    S --> T[Determine Dominant Trend]
    T --> U[Calculate HTF Bias 4H]
    U --> V[Calculate LTF Bias 3M+5M]
    V --> W[Calculate Alignment Score]
    W --> X[Determine Strength]
    
    X --> Y[recordWebhookReceipt]
    Y --> Z[WebhookAuditLog.add]
    Z --> AA[HTTP 200: Success Response]
    
    Y --> AB[(Database)]
    Z --> AC[(In-Memory Log)]
```

## 4. Data Storage Architecture

```mermaid
graph LR
    A[Signals Webhook] --> B[Decision Engine]
    B --> C[DecisionOutput]
    C --> D[(Audit Database)]
    C --> E[(In-Memory Log)]
    C --> F[Event Bus]
    
    G[SATY Phase Webhook] --> H[Phase Store]
    H --> I[Singleton Map]
    I --> J[Key: symbol:timeframe]
    J --> K[StoredPhase with TTL]
    K --> D
    K --> E
    K --> F
    
    L[Trend Webhook] --> M[Trend Store]
    M --> N[Singleton Map]
    N --> O[Key: ticker]
    O --> P[StoredTrend with TTL]
    P --> D
    P --> E
    
    F --> Q[Learning Modules]
    Q --> R[Performance Tracking]
    Q --> S[Strategy Optimization]
    Q --> T[Backtesting Analysis]
```

## 5. Decision Engine Gate Evaluation

```mermaid
graph TD
    A[DecisionContext] --> B[SPREAD_GATE]
    B --> C{spreadBps ≤ 12?}
    C -->|No| D[FAIL: SPREAD_TOO_WIDE]
    C -->|Yes| E[PASS]
    
    E --> F[VOLATILITY_GATE]
    F --> G{putCallRatio ≤ 2.0?}
    G -->|No| H[FAIL: VOLATILITY_TOO_HIGH]
    G -->|Yes| I[PASS]
    
    I --> J[GAMMA_GATE]
    J --> K{Gamma Aligns?}
    K -->|No| L[FAIL: GAMMA_BIAS_UNFAVORABLE]
    K -->|Yes| M[PASS]
    
    M --> N[PHASE_GATE]
    N --> O{|phase| ≥ 65?}
    O -->|No| P[FAIL: PHASE_CONFIDENCE_LOW]
    O -->|Yes| Q{Phase Aligns?}
    Q -->|No| R[FAIL: PHASE_MISALIGNMENT]
    Q -->|Yes| S[PASS]
    
    S --> T[SESSION_GATE]
    T --> U{session != AFTERHOURS?}
    U -->|No| V[FAIL: SESSION_NOT_ALLOWED]
    U -->|Yes| W[PASS]
    
    D --> X[Decision: REJECT]
    H --> X
    L --> X
    P --> X
    R --> X
    V --> X
    
    W --> Y{All Gates Passed?}
    Y -->|Yes| Z[Decision: ACCEPT]
    Y -->|No| X
    
    Z --> AA[Calculate Confidence]
    AA --> AB[Base: aiScore]
    AB --> AC{|phase| ≥ 80?}
    AC -->|Yes| AD[+0.5 boost]
    AC -->|No| AE{spreadBps ≤ 5?}
    AD --> AE
    AE -->|Yes| AF[+0.3 boost]
    AE -->|No| AG[Final Confidence]
    AF --> AG
    AG --> AH[Cap at 10.0]
```

## 6. Phase Store Regime Context

```mermaid
graph TD
    A[PhaseStore.getRegimeContext] --> B[Get 15M Phase]
    A --> C[Get 1H Phase]
    A --> D[Get 4H Phase]
    A --> E[Get 1D Phase]
    
    B --> F{Active?}
    C --> G{Active?}
    D --> H{Active?}
    E --> I{Active?}
    
    F -->|Yes| J[setup_phase]
    F -->|No| K[null]
    G -->|Yes| L[bias_phase]
    G -->|No| M[null]
    H -->|Yes| N[regime_phase]
    H -->|No| O[null]
    I -->|Yes| P[structural_phase]
    I -->|No| Q[null]
    
    J --> R[Count Active Phases]
    K --> R
    L --> R
    M --> R
    N --> R
    O --> R
    P --> R
    Q --> R
    
    R --> S{active_count ≥ 2?}
    S -->|No| T[is_aligned = false]
    S -->|Yes| U[Count local_bias]
    
    U --> V{Any bias appears 2+ times?}
    V -->|Yes| W[is_aligned = true]
    V -->|No| T
    
    W --> X[RegimeContext]
    T --> X
```

## 7. Trend Alignment Calculation

```mermaid
graph TD
    A[TrendWebhook] --> B[Extract All Timeframes]
    B --> C[3M, 5M, 15M, 30M, 1H, 4H, 1W, 1M]
    
    C --> D[Count Directions]
    D --> E[bullish_count]
    D --> F[bearish_count]
    D --> G[neutral_count]
    
    E --> H{Most Common?}
    F --> H
    G --> H
    
    H --> I[dominant_trend]
    
    C --> J[Get 4H Direction]
    J --> K[htf_bias]
    
    C --> L[Get 3M + 5M]
    L --> M[Average Directions]
    M --> N[ltf_bias]
    
    I --> O[Calculate Alignment %]
    E --> O
    F --> O
    G --> O
    
    O --> P{alignment_score}
    P -->|≥ 75| Q[strength: STRONG]
    P -->|50-74| R[strength: MODERATE]
    P -->|< 50| S[strength: WEAK]
    
    Q --> T[TrendAlignment]
    R --> T
    S --> T
    K --> T
    N --> T
```

## 8. Event Bus Pub/Sub Pattern

```mermaid
graph LR
    A[Signals Webhook] --> B[executionPublisher]
    C[SATY Phase Webhook] --> B
    D[Decision Engine] --> B
    
    B --> E[eventBus.publish]
    
    E --> F[SIGNAL_RECEIVED]
    E --> G[PHASE_RECEIVED]
    E --> H[DECISION_MADE]
    E --> I[TRADE_OPENED]
    E --> J[TRADE_CLOSED]
    
    F --> K[Event History]
    G --> K
    H --> K
    I --> K
    J --> K
    
    K --> L[Last 1000 Events]
    
    F --> M[Subscribers]
    G --> M
    H --> M
    I --> M
    J --> M
    
    M --> N[Learning Module 1]
    M --> O[Learning Module 2]
    M --> P[Learning Module N]
    
    N --> Q[Performance Tracking]
    O --> R[Strategy Optimization]
    P --> S[Backtesting Analysis]
```

---

## Legend

- **Rectangle**: Process/Function
- **Diamond**: Decision Point
- **Cylinder**: Data Storage
- **Parallelogram**: Input/Output
- **Rounded Rectangle**: Start/End
- **Solid Arrow**: Data Flow
- **Dashed Arrow**: Optional Flow

---

**Generated:** January 14, 2026
**Purpose:** Visual documentation of webhook processing flows
