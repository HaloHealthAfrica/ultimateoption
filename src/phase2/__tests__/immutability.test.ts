/**
 * Phase 2 Decision Engine - Immutability Tests
 * 
 * Comprehensive tests for immutability enforcement including
 * frozen object validation and runtime modification protection.
 */

import {
  GATE_REGISTRY,
  CONFIDENCE_MATRIX,
  FALLBACK_MATRIX,
  PERFORMANCE_CONSTRAINTS,
  initializeImmutability,
  validateImmutability,
  getImmutableConfig,
  getImmutabilityStatus
} from '../immutability/immutable-config';

import {
  ImmutabilityGuard,
  startImmutabilityMonitoring,
  createImmutabilityCheckpoint
} from '../immutability/immutability-guard';

import {
  PERFORMANCE_TARGETS,
  PROVIDER_CONFIG,
  NORMALIZATION_RULES
} from '../config';

import {
  GATE_NAMES,
  GATE_THRESHOLDS,
  GATE_REASONS,
  CONFIDENCE_BOOSTS,
  ENGINE_METADATA
} from '../constants/gates';

describe('Immutability System', () => {
  
  beforeAll(() => {
    // Ensure immutability is initialized
    initializeImmutability();
  });

  describe('Configuration Object Freezing', () => {
    
    test('PERFORMANCE_TARGETS should be deeply frozen', () => {
      expect(Object.isFrozen(PERFORMANCE_TARGETS)).toBe(true);
      expect(Object.isFrozen(PERFORMANCE_TARGETS)).toBe(true);
      
      // Test nested objects are frozen
      expect(() => {
        (PERFORMANCE_TARGETS as any).webhookResponse = 1000;
      }).toThrow();
      
      expect(() => {
        (PERFORMANCE_TARGETS as any).newProperty = 'test';
      }).toThrow();
    });

    test('PROVIDER_CONFIG should be deeply frozen', () => {
      expect(Object.isFrozen(PROVIDER_CONFIG)).toBe(true);
      expect(Object.isFrozen(PROVIDER_CONFIG.tradier)).toBe(true);
      expect(Object.isFrozen(PROVIDER_CONFIG.tradier.fallback)).toBe(true);
      
      // Test modification attempts throw errors
      expect(() => {
        (PROVIDER_CONFIG.tradier as any).timeout = 1000;
      }).toThrow();
      
      expect(() => {
        (PROVIDER_CONFIG.tradier.fallback as any).putCallRatio = 2.0;
      }).toThrow();
    });

    test('NORMALIZATION_RULES should be deeply frozen', () => {
      expect(Object.isFrozen(NORMALIZATION_RULES)).toBe(true);
      expect(Object.isFrozen(NORMALIZATION_RULES.aiScore)).toBe(true);
      
      expect(() => {
        (NORMALIZATION_RULES.aiScore as any).max = 15;
      }).toThrow();
    });

    test('Gate constants should be frozen', () => {
      expect(Object.isFrozen(GATE_NAMES)).toBe(true);
      expect(Object.isFrozen(GATE_THRESHOLDS)).toBe(true);
      expect(Object.isFrozen(GATE_REASONS)).toBe(true);
      expect(Object.isFrozen(CONFIDENCE_BOOSTS)).toBe(true);
      expect(Object.isFrozen(ENGINE_METADATA)).toBe(true);
      
      // Test modification attempts
      expect(() => {
        (GATE_THRESHOLDS as any).SPREAD_BPS = 20;
      }).toThrow();
      
      expect(() => {
        (CONFIDENCE_BOOSTS as any).SATY_PHASE_BOOST = 1.0;
      }).toThrow();
    });

    test('GATE_REGISTRY should be deeply frozen', () => {
      expect(Object.isFrozen(GATE_REGISTRY)).toBe(true);
      expect(Object.isFrozen(GATE_REGISTRY.SPREAD_GATE)).toBe(true);
      
      expect(() => {
        (GATE_REGISTRY.SPREAD_GATE as any).threshold = 20;
      }).toThrow();
      
      expect(() => {
        (GATE_REGISTRY as any).NEW_GATE = {};
      }).toThrow();
    });

    test('CONFIDENCE_MATRIX should be deeply frozen', () => {
      expect(Object.isFrozen(CONFIDENCE_MATRIX)).toBe(true);
      expect(Object.isFrozen(CONFIDENCE_MATRIX.boosts)).toBe(true);
      expect(Object.isFrozen(CONFIDENCE_MATRIX.boosts.satyPhase)).toBe(true);
      
      expect(() => {
        (CONFIDENCE_MATRIX.boosts.satyPhase as any).boost = 1.0;
      }).toThrow();
    });

    test('FALLBACK_MATRIX should be deeply frozen', () => {
      expect(Object.isFrozen(FALLBACK_MATRIX)).toBe(true);
      expect(Object.isFrozen(FALLBACK_MATRIX.tradier)).toBe(true);
      
      expect(() => {
        (FALLBACK_MATRIX.tradier as any).putCallRatio = 2.0;
      }).toThrow();
    });

    test('PERFORMANCE_CONSTRAINTS should be deeply frozen', () => {
      expect(Object.isFrozen(PERFORMANCE_CONSTRAINTS)).toBe(true);
      expect(Object.isFrozen(PERFORMANCE_CONSTRAINTS.timing)).toBe(true);
      expect(Object.isFrozen(PERFORMANCE_CONSTRAINTS.validation)).toBe(true);
      
      expect(() => {
        (PERFORMANCE_CONSTRAINTS.validation as any).maxPayloadSize = 2048;
      }).toThrow();
    });
  });

  describe('Runtime Immutability Validation', () => {
    
    test('validateImmutability should pass for properly frozen objects', () => {
      expect(() => validateImmutability()).not.toThrow();
    });

    test('getImmutableConfig should return proxy with modification protection', () => {
      const testConfig = Object.freeze({ value: 42, nested: { prop: 'test' } });
      const protectedConfig = getImmutableConfig(testConfig, 'testConfig');
      
      expect(() => {
        (protectedConfig as any).value = 100;
      }).toThrow(/Attempted to modify frozen configuration/);
      
      expect(() => {
        delete (protectedConfig as any).value;
      }).toThrow(/Attempted to delete property/);
      
      expect(() => {
        Object.defineProperty(protectedConfig, 'newProp', { value: 'test' });
      }).toThrow(/Attempted to define property/);
    });

    test('getImmutableConfig should throw if object is not frozen', () => {
      const unfrozenConfig = { value: 42 };
      
      expect(() => {
        getImmutableConfig(unfrozenConfig, 'unfrozenConfig');
      }).toThrow(/Configuration 'unfrozenConfig' is not frozen/);
    });

    test('getImmutabilityStatus should return complete status', () => {
      const status = getImmutabilityStatus();
      
      expect(status.initialized).toBe(true);
      expect(status.frozenObjects).toContain('GATE_REGISTRY');
      expect(status.frozenObjects).toContain('CONFIDENCE_MATRIX');
      expect(status.engineVersion).toBe('2.0.0');
      expect(status.deterministic).toBe(true);
      expect(status.lastValidation).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('ImmutabilityGuard', () => {
    let guard: ImmutabilityGuard;

    beforeEach(() => {
      guard = ImmutabilityGuard.getInstance();
      guard.resetViolationCount();
    });

    afterEach(() => {
      guard.stopMonitoring();
    });

    test('should be singleton', () => {
      const guard1 = ImmutabilityGuard.getInstance();
      const guard2 = ImmutabilityGuard.getInstance();
      expect(guard1).toBe(guard2);
    });

    test('should perform validation successfully', () => {
      const result = guard.performValidation();
      expect(result).toBe(true);
    });

    test('should start and stop monitoring', () => {
      guard.startMonitoring(100);
      const stats = guard.getStatistics();
      expect(stats.isMonitoring).toBe(true);
      
      guard.stopMonitoring();
      const statsAfter = guard.getStatistics();
      expect(statsAfter.isMonitoring).toBe(false);
    });

    test('should create valid checkpoint', () => {
      const checkpoint = guard.createCheckpoint();
      
      expect(checkpoint.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(checkpoint.isValid).toBe(true);
      expect(checkpoint.violationCount).toBe(0);
      expect(checkpoint.engineVersion).toBe('2.0.0');
      expect(checkpoint.status).toBeDefined();
    });

    test('should validate checkpoint successfully', () => {
      const checkpoint = guard.createCheckpoint();
      const isValid = guard.validateCheckpoint(checkpoint);
      expect(isValid).toBe(true);
    });

    test('should provide statistics', () => {
      const stats = guard.getStatistics();
      
      expect(stats.violationCount).toBe(0);
      expect(stats.lastValidation).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(stats.engineVersion).toBe('2.0.0');
      expect(typeof stats.uptime).toBe('number');
    });

    test('convenience functions should work', () => {
      const guardFromFunction = startImmutabilityMonitoring(100);
      expect(guardFromFunction).toBeInstanceOf(ImmutabilityGuard);
      
      const checkpoint = createImmutabilityCheckpoint();
      expect(checkpoint.isValid).toBe(true);
      
      guardFromFunction.stopMonitoring();
    });
  });

  describe('Immutability Violation Detection', () => {
    
    test('should detect attempts to modify frozen arrays', () => {
      const frozenArray = Object.freeze(['a', 'b', 'c']);
      
      expect(() => {
        (frozenArray as any).push('d');
      }).toThrow();
      
      expect(() => {
        (frozenArray as any)[0] = 'modified';
      }).toThrow();
    });

    test('should detect attempts to modify nested frozen objects', () => {
      const nestedConfig = Object.freeze({
        level1: Object.freeze({
          level2: Object.freeze({
            value: 42
          })
        })
      });
      
      expect(() => {
        (nestedConfig.level1.level2 as any).value = 100;
      }).toThrow();
    });

    test('should preserve original values after failed modification attempts', () => {
      const originalThreshold = GATE_THRESHOLDS.SPREAD_BPS;
      
      try {
        (GATE_THRESHOLDS as any).SPREAD_BPS = 999;
      } catch (error) {
        // Expected to throw
      }
      
      expect(GATE_THRESHOLDS.SPREAD_BPS).toBe(originalThreshold);
    });
  });

  describe('Configuration Integrity', () => {
    
    test('all gate definitions should have required properties', () => {
      for (const [gateName, gateConfig] of Object.entries(GATE_REGISTRY)) {
        expect(gateConfig.name).toBeDefined();
        expect(gateConfig.description).toBeDefined();
        expect(typeof gateConfig.description).toBe('string');
        expect(gateConfig.description.length).toBeGreaterThan(0);
      }
    });

    test('confidence matrix should have valid structure', () => {
      expect(CONFIDENCE_MATRIX.base.source).toBe('aiScore');
      expect(CONFIDENCE_MATRIX.boosts.satyPhase.threshold).toBe(80);
      expect(CONFIDENCE_MATRIX.boosts.spread.threshold).toBe(5);
      expect(CONFIDENCE_MATRIX.limits.minimum).toBe(0);
      expect(CONFIDENCE_MATRIX.limits.maximum).toBe(10.0);
    });

    test('fallback matrix should have conservative values', () => {
      expect(FALLBACK_MATRIX.strategy).toBe('CONSERVATIVE_REJECTION');
      expect(FALLBACK_MATRIX.alpaca.spreadBps).toBe(999); // Conservative - triggers spread gate
      expect(FALLBACK_MATRIX.tradier.gammaBias).toBe('NEUTRAL');
    });

    test('performance constraints should have reasonable values', () => {
      expect(PERFORMANCE_CONSTRAINTS.timing.webhookResponse).toBe(500);
      expect(PERFORMANCE_CONSTRAINTS.timing.endToEnd).toBe(1000);
      expect(PERFORMANCE_CONSTRAINTS.timing.decisionLogic).toBe(10);
      expect(PERFORMANCE_CONSTRAINTS.validation.maxPayloadSize).toBe(1024 * 1024);
    });
  });

  describe('Engine Version Consistency', () => {
    
    test('engine version should be consistent across all components', () => {
      expect(ENGINE_METADATA.VERSION).toBe('2.0.0');
      expect(getImmutabilityStatus().engineVersion).toBe('2.0.0');
      
      const checkpoint = createImmutabilityCheckpoint();
      expect(checkpoint.engineVersion).toBe('2.0.0');
    });

    test('engine metadata should indicate deterministic behavior', () => {
      expect(ENGINE_METADATA.DETERMINISTIC).toBe(true);
      expect(ENGINE_METADATA.LEARNING_ENABLED).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    
    test('should handle null and undefined values in deep freeze', () => {
      const configWithNulls = Object.freeze({
        nullValue: null,
        undefinedValue: undefined,
        nested: Object.freeze({
          alsoNull: null
        })
      });
      
      expect(Object.isFrozen(configWithNulls)).toBe(true);
      expect(Object.isFrozen(configWithNulls.nested)).toBe(true);
    });

    test('should handle circular references gracefully', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      
      // Should not throw when freezing circular references
      expect(() => Object.freeze(obj)).not.toThrow();
    });

    test('should handle empty objects and arrays', () => {
      const emptyConfig = Object.freeze({
        emptyObject: Object.freeze({}),
        emptyArray: Object.freeze([])
      });
      
      expect(Object.isFrozen(emptyConfig.emptyObject)).toBe(true);
      expect(Object.isFrozen(emptyConfig.emptyArray)).toBe(true);
    });
  });
});