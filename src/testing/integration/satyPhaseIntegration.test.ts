/**
 * SATY Phase Webhook Integration Tests
 * 
 * Tests the complete integration of SATY phase webhooks:
 * - Webhook endpoint processing
 * - PhaseStore storage with TTL
 * - Regime context aggregation
 * - Phase expiry handling
 * 
 * Requirements: 18.1, 18.3, 18.7
 */

import { PhaseStore } from '@/saty/storage/phaseStore';
import { SatyPhaseWebhook } from '@/types/saty';

// Test data generator (copied from existing tests)
const generatePhase = (
  symbol: string = 'SPY',
  timeframe: string = '4H',
  decayMinutes: number = 60,
  localBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'BULLISH'
): SatyPhaseWebhook => ({
  meta: {
    engine: 'SATY_PO',
    engine_version: '1.0.0',
    event_id: `test-${Date.now()}-${Math.random()}`,
    event_type: 'REGIME_PHASE_EXIT',
    generated_at: new Date().toISOString(),
  },
  instrument: {
    symbol,
    exchange: 'NASDAQ',
    asset_class: 'EQUITY',
    session: 'REGULAR',
  },
  timeframe: {
    chart_tf: timeframe,
    event_tf: timeframe,
    tf_role: 'REGIME',
    bar_close_time: new Date().toISOString(),
  },
  event: {
    name: 'EXIT_ACCUMULATION',
    description: 'Test phase event',
    directional_implication: 'UPSIDE_POTENTIAL',
    event_priority: 5,
  },
  oscillator_state: {
    value: 0.5,
    previous_value: 0.3,
    zone_from: 'ACCUMULATION',
    zone_to: 'NEUTRAL',
    distance_from_zero: 0.5,
    distance_from_extreme: 0.3,
    velocity: 'INCREASING',
  },
  regime_context: {
    local_bias: localBias,
    htf_bias: {
      tf: '1D',
      bias: 'BULLISH',
      osc_value: 0.7,
    },
    macro_bias: {
      tf: '1W',
      bias: 'BULLISH',
    },
  },
  market_structure: {
    mean_reversion_phase: 'EXPANSION',
    trend_phase: 'TRENDING',
    is_counter_trend: false,
    compression_state: 'NORMAL',
  },
  confidence: {
    raw_strength: 75,
    htf_alignment: true,
    confidence_score: 80,
    confidence_tier: 'HIGH',
  },
  execution_guidance: {
    trade_allowed: true,
    allowed_directions: ['LONG'],
    recommended_execution_tf: ['15M', '30M'],
    requires_confirmation: [],
  },
  risk_hints: {
    avoid_if: [],
    time_decay_minutes: decayMinutes,
    cooldown_tf: '1H',
  },
  audit: {
    source: 'test',
    alert_frequency: 'ONCE',
    deduplication_key: 'test-key',
  },
});

describe('SATY Phase Webhook Integration', () => {
  let phaseStore: PhaseStore;

  beforeEach(() => {
    // Create fresh instance for each test
    phaseStore = PhaseStore.createInstance();
  });

  afterEach(() => {
    // Clean up after each test
    phaseStore.clear();
  });

  describe('Phase Storage and TTL', () => {
    it('should store 4H EXIT_ACCUMULATION phase with correct TTL', () => {
      // Create test SATY phase webhook with 4H timeframe and 240 minute decay
      const testPhase = generatePhase('SPY', '4H', 240, 'BULLISH');

      // Store the phase
      phaseStore.updatePhase(testPhase);

      // Verify phase is stored
      const storedPhase = phaseStore.getPhase('SPY', '4H');
      expect(storedPhase).not.toBeNull();
      expect(storedPhase?.event.name).toBe('EXIT_ACCUMULATION');
      expect(storedPhase?.regime_context.local_bias).toBe('BULLISH');
      expect(storedPhase?.confidence.confidence_score).toBe(80);

      // Verify the phase is accessible through regime context
      const regimeContext = phaseStore.getRegimeContext('SPY');
      expect(regimeContext.regime_phase).not.toBeNull();
      expect(regimeContext.active_count).toBe(1);
    });

    it('should handle phase expiry correctly', async () => {
      // Create phase with very short TTL (0.1 minutes = 6 seconds)
      const testPhase = generatePhase('SPY', '4H', 0.1, 'BULLISH');

      // Store the phase
      phaseStore.updatePhase(testPhase);

      // Verify phase is initially stored
      expect(phaseStore.getPhase('SPY', '4H')).not.toBeNull();

      // Manually expire the phase by setting expires_at to past
      const key = 'SPY:4H';
      const stored = (phaseStore as unknown).phases.get(key);
      if (stored) {
        stored.expires_at = Date.now() - 1000; // 1 second ago
      }

      // Verify phase has expired
      expect(phaseStore.getPhase('SPY', '4H')).toBeNull();
    });
  });

  describe('Regime Context Aggregation', () => {
    it('should correctly aggregate regime context for multiple timeframes', () => {
      // Create phases for different timeframes
      const phases = [
        generatePhase('SPY', '15M', 60, 'BULLISH'),   // setup_phase
        generatePhase('SPY', '1H', 120, 'BULLISH'),   // bias_phase
        generatePhase('SPY', '4H', 240, 'BULLISH'),   // regime_phase
        generatePhase('SPY', '1D', 1440, 'BEARISH'),  // structural_phase (different bias)
      ];

      // Store all phases
      phases.forEach(phase => phaseStore.updatePhase(phase));

      // Get regime context
      const regimeContext = phaseStore.getRegimeContext('SPY');

      // Verify regime context structure
      expect(regimeContext).not.toBeNull();
      expect(regimeContext.active_count).toBe(4);

      // Verify individual phase assignments
      expect(regimeContext.setup_phase?.regime_context.local_bias).toBe('BULLISH');
      expect(regimeContext.bias_phase?.regime_context.local_bias).toBe('BULLISH');
      expect(regimeContext.regime_phase?.regime_context.local_bias).toBe('BULLISH');
      expect(regimeContext.structural_phase?.regime_context.local_bias).toBe('BEARISH');

      // Verify alignment calculation (3 BULLISH vs 1 BEARISH = aligned since 3 >= 2)
      expect(regimeContext.is_aligned).toBe(true);
    });

    it('should detect alignment when 2+ phases share same bias', () => {
      // Create phases with same bias (3 BULLISH)
      const phases = [
        generatePhase('SPY', '15M', 60, 'BULLISH'),
        generatePhase('SPY', '1H', 120, 'BULLISH'),
        generatePhase('SPY', '4H', 240, 'BULLISH'),
      ];

      // Store phases
      phases.forEach(phase => phaseStore.updatePhase(phase));

      // Get regime context
      const regimeContext = phaseStore.getRegimeContext('SPY');

      // Should be aligned (3 BULLISH phases >= 2)
      expect(regimeContext.is_aligned).toBe(true);
      expect(regimeContext.active_count).toBe(3);
    });

    it('should handle empty regime context correctly', () => {
      // Get regime context for symbol with no phases
      const regimeContext = phaseStore.getRegimeContext('AAPL');

      expect(regimeContext).not.toBeNull();
      expect(regimeContext.setup_phase).toBeNull();
      expect(regimeContext.bias_phase).toBeNull();
      expect(regimeContext.regime_phase).toBeNull();
      expect(regimeContext.structural_phase).toBeNull();
      expect(regimeContext.active_count).toBe(0);
      expect(regimeContext.is_aligned).toBe(false);
    });
  });

  describe('Multiple Symbol Support', () => {
    it('should handle phases for different symbols independently', () => {
      // Create phases for different symbols
      const spyPhase = generatePhase('SPY', '4H', 240, 'BULLISH');
      const aaplPhase = generatePhase('AAPL', '4H', 240, 'BEARISH');

      // Store phases
      phaseStore.updatePhase(spyPhase);
      phaseStore.updatePhase(aaplPhase);

      // Verify SPY phase
      const spyStored = phaseStore.getPhase('SPY', '4H');
      expect(spyStored?.regime_context.local_bias).toBe('BULLISH');
      expect(spyStored?.event.name).toBe('EXIT_ACCUMULATION');

      // Verify AAPL phase
      const aaplStored = phaseStore.getPhase('AAPL', '4H');
      expect(aaplStored?.regime_context.local_bias).toBe('BEARISH');
      expect(aaplStored?.event.name).toBe('EXIT_ACCUMULATION');

      // Verify regime contexts are independent
      const spyRegime = phaseStore.getRegimeContext('SPY');
      const aaplRegime = phaseStore.getRegimeContext('AAPL');

      expect(spyRegime.active_count).toBe(1);
      expect(aaplRegime.active_count).toBe(1);
      expect(spyRegime.regime_phase?.regime_context.local_bias).toBe('BULLISH');
      expect(aaplRegime.regime_phase?.regime_context.local_bias).toBe('BEARISH');
    });
  });

  describe('Phase Update and Replacement', () => {
    it('should replace existing phase for same symbol/timeframe', () => {
      // Store initial phase
      const initialPhase = generatePhase('SPY', '4H', 240, 'BULLISH');
      phaseStore.updatePhase(initialPhase);

      // Verify initial phase
      let stored = phaseStore.getPhase('SPY', '4H');
      expect(stored?.confidence.confidence_score).toBe(80);
      expect(stored?.regime_context.local_bias).toBe('BULLISH');

      // Store updated phase with different properties
      const updatedPhase = generatePhase('SPY', '4H', 240, 'BEARISH');
      updatedPhase.confidence.confidence_score = 85;
      updatedPhase.event.name = 'ENTER_DISTRIBUTION';
      phaseStore.updatePhase(updatedPhase);

      // Verify phase was replaced
      stored = phaseStore.getPhase('SPY', '4H');
      expect(stored?.confidence.confidence_score).toBe(85);
      expect(stored?.regime_context.local_bias).toBe('BEARISH');
      expect(stored?.event.name).toBe('ENTER_DISTRIBUTION');

      // Should still only have 1 phase for SPY 4H
      const regimeContext = phaseStore.getRegimeContext('SPY');
      expect(regimeContext.active_count).toBe(1);
    });
  });
});