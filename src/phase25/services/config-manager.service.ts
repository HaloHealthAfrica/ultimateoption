/**
 * Configuration Manager Service for Phase 2.5 Decision Engine
 * 
 * Manages immutable configuration rules and engine version management.
 * All configuration is frozen in production to ensure deterministic behavior.
 */

import { 
  IConfigManager, 
  EngineConfig, 
  ValidationResult 
} from '../types';
import { ENGINE_VERSION,
  PHASE_RULES,
  VOLATILITY_CAPS,
  QUALITY_BOOSTS, SIZE_BOUNDS,
  CONFIDENCE_THRESHOLDS,
  AI_SCORE_THRESHOLDS,
  ALIGNMENT_THRESHOLDS,
  CONTEXT_RULES,
  API_TIMEOUTS,
  RISK_GATES } from '../config/constants';
import * as crypto from 'crypto';

export class ConfigManagerService implements IConfigManager {
  private config: EngineConfig | null = null;
  private configHash: string | null = null;
  private frozen: boolean = false;

  constructor() {
    // Load configuration on instantiation
    this.config = this.loadConfig();
    this.configHash = this.calculateConfigHash();
  }

  /**
   * Load the complete engine configuration from constants
   */
  loadConfig(): EngineConfig {
    const config: EngineConfig = {
      version: ENGINE_VERSION,
      
      // Gate thresholds
      gates: {
        maxSpreadBps: RISK_GATES.MAX_SPREAD_BPS,
        maxAtrSpike: RISK_GATES.MAX_ATR_SPIKE,
        minDepthScore: RISK_GATES.MIN_DEPTH_SCORE,
        minConfidence: RISK_GATES.MIN_CONFIDENCE,
        restrictedSessions: [...RISK_GATES.RESTRICTED_SESSIONS]
      },
      
      // Phase rules
      phases: {
        1: { 
          allowed: [...PHASE_RULES[1].allowed], 
          sizeCap: PHASE_RULES[1].sizeCap 
        },
        2: { 
          allowed: [...PHASE_RULES[2].allowed], 
          sizeCap: PHASE_RULES[2].sizeCap 
        },
        3: { 
          allowed: [...PHASE_RULES[3].allowed], 
          sizeCap: PHASE_RULES[3].sizeCap 
        },
        4: { 
          allowed: [...PHASE_RULES[4].allowed], 
          sizeCap: PHASE_RULES[4].sizeCap 
        }
      },
      
      // Multipliers
      volatilityCaps: {
        LOW: VOLATILITY_CAPS.LOW,
        NORMAL: VOLATILITY_CAPS.NORMAL,
        HIGH: VOLATILITY_CAPS.HIGH
      },
      
      qualityBoosts: {
        EXTREME: QUALITY_BOOSTS.EXTREME,
        HIGH: QUALITY_BOOSTS.HIGH,
        MEDIUM: QUALITY_BOOSTS.MEDIUM
      },
      
      sizeBounds: {
        min: SIZE_BOUNDS.MIN,
        max: SIZE_BOUNDS.MAX
      },
      
      // Confidence and scoring thresholds
      confidenceThresholds: {
        execute: CONFIDENCE_THRESHOLDS.EXECUTE,
        wait: CONFIDENCE_THRESHOLDS.WAIT,
        skip: CONFIDENCE_THRESHOLDS.SKIP
      },
      
      aiScoreThresholds: {
        minimum: AI_SCORE_THRESHOLDS.MINIMUM,
        penaltyBelow: AI_SCORE_THRESHOLDS.PENALTY_BELOW
      },
      
      alignmentThresholds: {
        strongAlignment: ALIGNMENT_THRESHOLDS.STRONG_ALIGNMENT,
        bonusMultiplier: ALIGNMENT_THRESHOLDS.BONUS_MULTIPLIER
      },
      
      // Context rules
      contextRules: {
        maxAge: CONTEXT_RULES.MAX_AGE_MS,
        requiredSources: [...CONTEXT_RULES.REQUIRED_SOURCES],
        optionalSources: [...CONTEXT_RULES.OPTIONAL_SOURCES]
      },
      
      // API configuration (placeholder - will be enhanced in later tasks)
      feeds: {
        tradier: {
          enabled: true,
          timeout: API_TIMEOUTS.MARKET_CONTEXT,
          retries: 2,
          baseUrl: 'https://api.tradier.com/v1',
          fallbackValues: {
            options: {
              putCallRatio: 1.0,
              ivPercentile: 50,
              gammaBias: 'NEUTRAL' as const,
              optionVolume: 0,
              maxPain: 0
            }
          }
        },
        twelveData: {
          enabled: true,
          timeout: API_TIMEOUTS.MARKET_CONTEXT,
          retries: 2,
          baseUrl: 'https://api.twelvedata.com',
          fallbackValues: {
            stats: {
              atr14: 1.0,
              rv20: 0.2,
              trendSlope: 0,
              rsi: 50,
              volume: 0,
              volumeRatio: 1.0
            }
          }
        },
        alpaca: {
          enabled: true,
          timeout: API_TIMEOUTS.MARKET_CONTEXT,
          retries: 2,
          baseUrl: 'https://data.alpaca.markets/v2',
          fallbackValues: {
            liquidity: {
              spreadBps: 5,
              depthScore: 50,
              tradeVelocity: 'NORMAL' as const,
              bidSize: 100,
              askSize: 100
            }
          }
        }
      },
      
      // Timeouts
      timeouts: {
        webhookProcessing: API_TIMEOUTS.WEBHOOK_PROCESSING,
        marketContext: API_TIMEOUTS.MARKET_CONTEXT,
        decisionEngine: API_TIMEOUTS.DECISION_ENGINE
      }
    };

    return config;
  }

  /**
   * Validate the configuration for completeness and correctness
   */
  validateConfig(config: EngineConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate version
    if (!config.version || typeof config.version !== 'string') {
      errors.push('Configuration must have a valid version string');
    }

    // Validate gates
    if (!config.gates) {
      errors.push('Configuration must include gates section');
    } else {
      if (typeof config.gates.maxSpreadBps !== 'number' || config.gates.maxSpreadBps <= 0) {
        errors.push('gates.maxSpreadBps must be a positive number');
      }
      if (typeof config.gates.maxAtrSpike !== 'number' || config.gates.maxAtrSpike <= 0) {
        errors.push('gates.maxAtrSpike must be a positive number');
      }
      if (typeof config.gates.minDepthScore !== 'number' || config.gates.minDepthScore < 0 || config.gates.minDepthScore > 100) {
        errors.push('gates.minDepthScore must be a number between 0 and 100');
      }
      if (typeof config.gates.minConfidence !== 'number' || config.gates.minConfidence < 0 || config.gates.minConfidence > 100) {
        errors.push('gates.minConfidence must be a number between 0 and 100');
      }
      if (!Array.isArray(config.gates.restrictedSessions)) {
        errors.push('gates.restrictedSessions must be an array');
      }
    }

    // Validate phases
    if (!config.phases) {
      errors.push('Configuration must include phases section');
    } else {
      for (const phase of [1, 2, 3, 4]) {
        const phaseConfig = config.phases[phase];
        if (!phaseConfig) {
          errors.push(`Phase ${phase} configuration is missing`);
          continue;
        }
        
        if (!Array.isArray(phaseConfig.allowed)) {
          errors.push(`Phase ${phase} allowed directions must be an array`);
        } else {
          for (const direction of phaseConfig.allowed) {
            if (direction !== 'LONG' && direction !== 'SHORT') {
              errors.push(`Phase ${phase} contains invalid direction: ${direction}`);
            }
          }
        }
        
        if (typeof phaseConfig.sizeCap !== 'number' || phaseConfig.sizeCap <= 0) {
          errors.push(`Phase ${phase} sizeCap must be a positive number`);
        }
      }
    }

    // Validate size bounds
    if (!config.sizeBounds) {
      errors.push('Configuration must include sizeBounds section');
    } else {
      if (typeof config.sizeBounds.min !== 'number' || config.sizeBounds.min <= 0) {
        errors.push('sizeBounds.min must be a positive number');
      }
      if (typeof config.sizeBounds.max !== 'number' || config.sizeBounds.max <= 0) {
        errors.push('sizeBounds.max must be a positive number');
      }
      if (config.sizeBounds.min >= config.sizeBounds.max) {
        errors.push('sizeBounds.min must be less than sizeBounds.max');
      }
    }

    // Validate volatility caps
    if (!config.volatilityCaps) {
      errors.push('Configuration must include volatilityCaps section');
    } else {
      const requiredVolatilities = ['LOW', 'NORMAL', 'HIGH'];
      for (const vol of requiredVolatilities) {
        if (typeof config.volatilityCaps[vol] !== 'number' || config.volatilityCaps[vol] <= 0) {
          errors.push(`volatilityCaps.${vol} must be a positive number`);
        }
      }
    }

    // Validate quality boosts
    if (!config.qualityBoosts) {
      errors.push('Configuration must include qualityBoosts section');
    } else {
      const requiredQualities = ['EXTREME', 'HIGH', 'MEDIUM'];
      for (const quality of requiredQualities) {
        if (typeof config.qualityBoosts[quality] !== 'number' || config.qualityBoosts[quality] <= 0) {
          errors.push(`qualityBoosts.${quality} must be a positive number`);
        }
      }
    }

    // Validate timeouts
    if (!config.timeouts) {
      errors.push('Configuration must include timeouts section');
    } else {
      const requiredTimeouts = ['webhookProcessing', 'marketContext', 'decisionEngine'];
      const timeouts = config.timeouts as Record<string, unknown>;
      for (const timeout of requiredTimeouts) {
        if (typeof timeouts[timeout] !== 'number' || (timeouts[timeout] as number) <= 0) {
          errors.push(`timeouts.${timeout} must be a positive number`);
        }
      }
    }

    // Validate feeds
    if (!config.feeds) {
      errors.push('Configuration must include feeds section');
    } else {
      const requiredFeeds = ['tradier', 'twelveData', 'alpaca'];
      for (const feedName of requiredFeeds) {
        const feed = config.feeds[feedName];
        if (!feed) {
          errors.push(`Feed configuration for ${feedName} is missing`);
          continue;
        }
        
        if (typeof feed.enabled !== 'boolean') {
          errors.push(`Feed ${feedName}.enabled must be a boolean`);
        }
        if (typeof feed.timeout !== 'number' || feed.timeout <= 0) {
          errors.push(`Feed ${feedName}.timeout must be a positive number`);
        }
        if (typeof feed.retries !== 'number' || feed.retries < 0) {
          errors.push(`Feed ${feedName}.retries must be a non-negative number`);
        }
        if (typeof feed.baseUrl !== 'string' || !feed.baseUrl) {
          errors.push(`Feed ${feedName}.baseUrl must be a non-empty string`);
        }
        if (!feed.fallbackValues || typeof feed.fallbackValues !== 'object') {
          errors.push(`Feed ${feedName}.fallbackValues must be an object`);
        }
      }
    }

    // Add warnings for potentially problematic configurations
    if (config.gates?.maxSpreadBps && config.gates.maxSpreadBps > 20) {
      warnings.push('maxSpreadBps is quite high, may allow poor execution quality');
    }
    
    if (config.sizeBounds?.max && config.sizeBounds.max > 5.0) {
      warnings.push('sizeBounds.max is very high, consider risk implications');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get the current engine version
   */
  getEngineVersion(): string {
    return ENGINE_VERSION;
  }

  /**
   * Get a hash of the current configuration for change detection
   */
  getConfigHash(): string {
    if (!this.configHash) {
      this.configHash = this.calculateConfigHash();
    }
    return this.configHash;
  }

  /**
   * Freeze the configuration to prevent runtime modifications
   */
  freezeConfig(): void {
    if (this.config && !this.frozen) {
      // Deep freeze the configuration object
      this.deepFreeze(this.config);
      this.frozen = true;
      
      console.log(`Configuration frozen for engine version ${this.getEngineVersion()}`);
      console.log(`Configuration hash: ${this.getConfigHash()}`);
    }
  }

  /**
   * Check if configuration is frozen
   */
  isFrozen(): boolean {
    return this.frozen;
  }

  /**
   * Get the current configuration (read-only)
   */
  getConfig(): Readonly<EngineConfig> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return this.config;
  }

  /**
   * Validate the current configuration
   */
  validateCurrentConfig(): ValidationResult {
    if (!this.config) {
      return {
        valid: false,
        errors: ['Configuration not loaded'],
        warnings: []
      };
    }
    return this.validateConfig(this.config);
  }

  // Private helper methods

  private calculateConfigHash(): string {
    if (!this.config) {
      return '';
    }
    
    // Create a deterministic string representation of the config
    const configString = JSON.stringify(this.config, Object.keys(this.config).sort());
    return crypto.createHash('sha256').update(configString).digest('hex').substring(0, 16);
  }

  private deepFreeze(obj: unknown): void {
    // Retrieve the property names defined on obj
    Object.getOwnPropertyNames(obj).forEach((name) => {
      const value = obj[name];

      // Freeze properties before freezing self
      if (value && typeof value === 'object') {
        this.deepFreeze(value);
      }
    });

    return Object.freeze(obj);
  }
}