/**
 * Events Module
 * 
 * Exports event bus functionality for pub/sub communication.
 */

export {
  // Types
  type EventType,
  type EventPayloads,
  type Event,
  type EventHandler,
  type Subscription,
  
  // Event Bus
  eventBus,
  createEventBus,
  
  // Publishers (for execution modules)
  executionPublisher,
  systemPublisher,
  
  // Subscribers (for learning modules)
  learningSubscriber,
} from './eventBus';
