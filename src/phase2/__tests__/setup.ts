/**
 * Phase 2 Decision Engine - Test Setup
 * 
 * Global test configuration and setup for all Phase 2 tests.
 * Configures mocks, test utilities, and environment settings.
 */

import { jest } from '@jest/globals';

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  
  toBeValidDecision(received: any) {
    const validDecisions = ['APPROVE', 'REJECT'];
    const pass = validDecisions.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid decision`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid decision (APPROVE or REJECT)`,
        pass: false,
      };
    }
  },
  
  toHaveValidAuditTrail(received: any) {
    const requiredFields = [
      'context_snapshot',
      'gate_results',
      'processing_time_ms',
      'decision_timestamp'
    ];
    
    const hasAllFields = requiredFields.every(field => 
      received && typeof received === 'object' && field in received
    );
    
    if (hasAllFields) {
      return {
        message: () => `expected audit trail not to have all required fields`,
        pass: true,
      };
    } else {
      const missingFields = requiredFields.filter(field => !(field in received));
      return {
        message: () => `expected audit trail to have all required fields. Missing: ${missingFields.join(', ')}`,
        pass: false,
      };
    }
  }
});

// Declare custom matchers for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toBeValidDecision(): R;
      toHaveValidAuditTrail(): R;
    }
  }
}

// Global test configuration
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
  
  // Mock external API calls by default
  jest.setTimeout(30000); // 30 second timeout for integration tests
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset any global state
  if (global.gc) {
    global.gc(); // Force garbage collection if available
  }
});

afterEach(() => {
  // Clean up after each test
  jest.restoreAllMocks();
});

afterAll(() => {
  // Final cleanup
  jest.clearAllTimers();
});

// Mock console methods to reduce test noise (but keep errors)
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: originalConsole.error, // Keep errors visible
  debug: jest.fn()
};

// Utility functions for tests
export const testUtils = {
  /**
   * Create a valid test signal payload
   */
  createValidSignal: (overrides: any = {}) => ({
    signal: {
      type: 'LONG',
      aiScore: 7.5,
      symbol: 'TEST',
      timestamp: Date.now(),
      ...overrides.signal
    },
    satyPhase: {
      phase: 75,
      confidence: 80,
      ...overrides.satyPhase
    },
    marketSession: 'OPEN',
    ...overrides
  }),
  
  /**
   * Create a valid SATY phase payload
   */
  createValidSatyPhase: (overrides: any = {}) => ({
    phase: 80,
    confidence: 85,
    symbol: 'TEST',
    timestamp: Date.now(),
    ...overrides
  }),
  
  /**
   * Wait for a specified amount of time
   */
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  /**
   * Generate random test data within bounds
   */
  randomInRange: (min: number, max: number) => Math.random() * (max - min) + min,
  
  /**
   * Create mock provider responses
   */
  createMockProviderResponse: (dataSource: 'API' | 'FALLBACK' = 'API') => ({
    optionsData: {
      putCallRatio: 0.85,
      ivPercentile: 45,
      gammaBias: 'POSITIVE' as const,
      dataSource
    },
    marketStats: {
      atr14: 0.025,
      rv20: 0.022,
      trendSlope: 0.15,
      dataSource
    },
    liquidityData: {
      spreadBps: 8,
      marketDepth: 1500000,
      volumeVelocity: 0.75,
      dataSource
    }
  }),
  
  /**
   * Validate decision output structure
   */
  validateDecisionOutput: (output: any) => {
    expect(output).toEqual(expect.objectContaining({
      decision: expect.stringMatching(/^(APPROVE|REJECT)$/),
      direction: expect.stringMatching(/^(LONG|SHORT)$/),
      symbol: expect.any(String),
      confidence: expect.any(Number),
      engine_version: expect.any(String),
      timestamp: expect.any(String),
      audit: expect.objectContaining({
        context_snapshot: expect.any(Object),
        gate_results: expect.any(Object),
        processing_time_ms: expect.any(Number),
        decision_timestamp: expect.any(String)
      })
    }));
    
    // Validate confidence bounds
    expect(output.confidence).toBeGreaterThanOrEqual(0);
    expect(output.confidence).toBeLessThanOrEqual(10);
    
    // Validate processing time is reasonable
    expect(output.audit.processing_time_ms).toBeLessThan(5000);
  }
};

// Performance monitoring for tests
export const performanceMonitor = {
  startTime: 0,
  
  start() {
    this.startTime = Date.now();
  },
  
  end(testName: string, maxDuration: number = 1000) {
    const duration = Date.now() - this.startTime;
    if (duration > maxDuration) {
      console.warn(`⚠️  Performance warning: ${testName} took ${duration}ms (max: ${maxDuration}ms)`);
    }
    return duration;
  }
};

// Memory monitoring for tests
export const memoryMonitor = {
  initialMemory: 0,
  
  start() {
    if (global.gc) global.gc();
    this.initialMemory = process.memoryUsage().heapUsed;
  },
  
  end(testName: string, maxIncrease: number = 50 * 1024 * 1024) { // 50MB default
    if (global.gc) global.gc();
    const currentMemory = process.memoryUsage().heapUsed;
    const increase = currentMemory - this.initialMemory;
    
    if (increase > maxIncrease) {
      console.warn(`⚠️  Memory warning: ${testName} increased memory by ${Math.round(increase / 1024 / 1024)}MB`);
    }
    
    return increase;
  }
};

// Export for use in tests
export { jest };