/**
 * Event Bus
 * 
 * Provides pub/sub communication between execution and learning modules.
 * Execution modules ONLY publish events.
 * Learning modules ONLY subscribe to events.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */

import { EnrichedSignal } from '../types/signal';
import { SatyPhaseWebhook } from '../types/saty';
import { Decision, DecisionBreakdown } from '../types/decision';
import { Execution } from '../types/options';
import { ExitData, LedgerEntry } from '../types/ledger';

/**
 * Event types supported by the event bus
 * Requirement 12.1
 */
export type EventType =
  | 'SIGNAL_RECEIVED'
  | 'SIGNAL_EXPIRED'
  | 'PHASE_RECEIVED'
  | 'PHASE_EXPIRED'
  | 'DECISION_MADE'
  | 'TRADE_OPENED'
  | 'TRADE_CLOSED'
  | 'LEDGER_ENTRY_CREATED'
  | 'SAFETY_ALERT'
  | 'METRICS_UPDATED';

/**
 * Event payloads for each event type
 */
export interface EventPayloads {
  SIGNAL_RECEIVED: {
    signal: EnrichedSignal;
    timeframe: string;
    validity_minutes: number;
  };
  SIGNAL_EXPIRED: {
    signal: EnrichedSignal;
    timeframe: string;
    expired_at: number;
  };
  PHASE_RECEIVED: {
    phase: SatyPhaseWebhook;
    timeframe: string;
    decay_minutes: number;
  };
  PHASE_EXPIRED: {
    phase: SatyPhaseWebhook;
    timeframe: string;
    expired_at: number;
  };
  DECISION_MADE: {
    decision: Decision;
    reason: string;
    breakdown: DecisionBreakdown;
    confluence_score: number;
    engine_version: string;
  };
  TRADE_OPENED: {
    entry_id: string;
    execution: Execution;
    signal: EnrichedSignal;
  };
  TRADE_CLOSED: {
    entry_id: string;
    exit: ExitData;
    execution: Execution;
  };
  LEDGER_ENTRY_CREATED: {
    entry: LedgerEntry;
  };
  SAFETY_ALERT: {
    alert_type: string;
    severity: string;
    message: string;
    details: Record<string, unknown>;
  };
  METRICS_UPDATED: {
    sample_size: number;
    win_rate: number;
    expectancy: number;
    updated_at: number;
  };
}

/**
 * Event with type and payload
 */
export interface Event<T extends EventType = EventType> {
  type: T;
  payload: EventPayloads[T];
  timestamp: number;
  source: 'EXECUTION' | 'LEARNING' | 'SYSTEM';
}

/**
 * Event handler function type
 */
export type EventHandler<T extends EventType> = (event: Event<T>) => void;

/**
 * Subscription handle for unsubscribing
 */
export interface Subscription {
  unsubscribe: () => void;
}


/**
 * Event Bus implementation
 * Requirement 12.2, 12.3, 12.4
 */
class EventBusImpl {
  private handlers: Map<EventType, Set<EventHandler<EventType>>> = new Map();
  private eventHistory: Event[] = [];
  private maxHistorySize: number = 1000;

  /**
   * Subscribe to an event type
   * Requirement 12.3: Learning modules subscribe
   * 
   * @param eventType - Type of event to subscribe to
   * @param handler - Handler function to call when event is published
   * @returns Subscription handle for unsubscribing
   */
  subscribe<T extends EventType>(
    eventType: T,
    handler: EventHandler<T>
  ): Subscription {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    
    const handlers = this.handlers.get(eventType)!;
    handlers.add(handler as EventHandler<EventType>);
    
    return {
      unsubscribe: () => {
        handlers.delete(handler as EventHandler<EventType>);
      },
    };
  }

  /**
   * Publish an event
   * Requirement 12.2: Execution modules publish
   * 
   * @param eventType - Type of event
   * @param payload - Event payload
   * @param source - Source of the event
   */
  publish<T extends EventType>(
    eventType: T,
    payload: EventPayloads[T],
    source: 'EXECUTION' | 'LEARNING' | 'SYSTEM' = 'EXECUTION'
  ): void {
    const event: Event<T> = {
      type: eventType,
      payload,
      timestamp: Date.now(),
      source,
    };
    
    // Store in history
    this.eventHistory.push(event as Event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
    
    // Notify handlers
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event as Event);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      }
    }
  }

  /**
   * Get event history
   * 
   * @param eventType - Optional filter by event type
   * @param limit - Maximum number of events to return
   * @returns Array of events
   */
  getHistory(eventType?: EventType, limit: number = 100): Event[] {
    let events = this.eventHistory;
    
    if (eventType) {
      events = events.filter(e => e.type === eventType);
    }
    
    return events.slice(-limit);
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions(): void {
    this.handlers.clear();
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get subscriber count for an event type
   * 
   * @param eventType - Event type to check
   * @returns Number of subscribers
   */
  getSubscriberCount(eventType: EventType): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }

  /**
   * Check if there are any subscribers for an event type
   * 
   * @param eventType - Event type to check
   * @returns True if there are subscribers
   */
  hasSubscribers(eventType: EventType): boolean {
    return this.getSubscriberCount(eventType) > 0;
  }
}

/**
 * Singleton event bus instance
 */
export const eventBus = new EventBusImpl();

/**
 * Create a new isolated event bus (for testing)
 * 
 * @returns New EventBus instance
 */
export function createEventBus(): EventBusImpl {
  return new EventBusImpl();
}

/**
 * Helper to create typed publish functions for execution modules
 * Requirement 12.2: Execution only publishes
 */
export const executionPublisher = {
  signalReceived: (signal: EnrichedSignal, timeframe: string, validity_minutes: number) => {
    eventBus.publish('SIGNAL_RECEIVED', { signal, timeframe, validity_minutes }, 'EXECUTION');
  },
  
  signalExpired: (signal: EnrichedSignal, timeframe: string) => {
    eventBus.publish('SIGNAL_EXPIRED', { signal, timeframe, expired_at: Date.now() }, 'EXECUTION');
  },
  
  phaseReceived: (phase: SatyPhaseWebhook, timeframe: string, decay_minutes: number) => {
    eventBus.publish('PHASE_RECEIVED', { phase, timeframe, decay_minutes }, 'EXECUTION');
  },
  
  phaseExpired: (phase: SatyPhaseWebhook, timeframe: string) => {
    eventBus.publish('PHASE_EXPIRED', { phase, timeframe, expired_at: Date.now() }, 'EXECUTION');
  },
  
  decisionMade: (
    decision: Decision,
    reason: string,
    breakdown: DecisionBreakdown,
    confluence_score: number,
    engine_version: string
  ) => {
    eventBus.publish('DECISION_MADE', {
      decision,
      reason,
      breakdown,
      confluence_score,
      engine_version,
    }, 'EXECUTION');
  },
  
  tradeOpened: (entry_id: string, execution: Execution, signal: EnrichedSignal) => {
    eventBus.publish('TRADE_OPENED', { entry_id, execution, signal }, 'EXECUTION');
  },
  
  tradeClosed: (entry_id: string, exit: ExitData, execution: Execution) => {
    eventBus.publish('TRADE_CLOSED', { entry_id, exit, execution }, 'EXECUTION');
  },
  
  ledgerEntryCreated: (entry: LedgerEntry) => {
    eventBus.publish('LEDGER_ENTRY_CREATED', { entry }, 'EXECUTION');
  },
};

/**
 * Helper to create typed subscribe functions for learning modules
 * Requirement 12.3: Learning only subscribes
 */
export const learningSubscriber = {
  onSignalReceived: (handler: EventHandler<'SIGNAL_RECEIVED'>) => {
    return eventBus.subscribe('SIGNAL_RECEIVED', handler);
  },
  
  onSignalExpired: (handler: EventHandler<'SIGNAL_EXPIRED'>) => {
    return eventBus.subscribe('SIGNAL_EXPIRED', handler);
  },
  
  onDecisionMade: (handler: EventHandler<'DECISION_MADE'>) => {
    return eventBus.subscribe('DECISION_MADE', handler);
  },
  
  onTradeOpened: (handler: EventHandler<'TRADE_OPENED'>) => {
    return eventBus.subscribe('TRADE_OPENED', handler);
  },
  
  onTradeClosed: (handler: EventHandler<'TRADE_CLOSED'>) => {
    return eventBus.subscribe('TRADE_CLOSED', handler);
  },
  
  onLedgerEntryCreated: (handler: EventHandler<'LEDGER_ENTRY_CREATED'>) => {
    return eventBus.subscribe('LEDGER_ENTRY_CREATED', handler);
  },
  
  onMetricsUpdated: (handler: EventHandler<'METRICS_UPDATED'>) => {
    return eventBus.subscribe('METRICS_UPDATED', handler);
  },
};

/**
 * System publisher for safety alerts
 */
export const systemPublisher = {
  safetyAlert: (alert_type: string, severity: string, message: string, details: Record<string, unknown>) => {
    eventBus.publish('SAFETY_ALERT', { alert_type, severity, message, details }, 'SYSTEM');
  },
  
  metricsUpdated: (sample_size: number, win_rate: number, expectancy: number) => {
    eventBus.publish('METRICS_UPDATED', {
      sample_size,
      win_rate,
      expectancy,
      updated_at: Date.now(),
    }, 'SYSTEM');
  },
};
