/**
 * Phase 2 Decision Engine - Immutability Guard
 * 
 * Runtime protection against configuration modifications.
 * Provides monitoring and enforcement of immutability constraints.
 */

import { validateImmutability, getImmutabilityStatus } from './immutable-config';
import { ENGINE_VERSION } from '../types';

/**
 * Immutability Guard - Runtime protection system
 */
export class ImmutabilityGuard {
  private static instance: ImmutabilityGuard;
  private validationInterval: NodeJS.Timeout | null = null;
  private violationCount = 0;
  private lastValidation: Date = new Date();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ImmutabilityGuard {
    if (!ImmutabilityGuard.instance) {
      ImmutabilityGuard.instance = new ImmutabilityGuard();
    }
    return ImmutabilityGuard.instance;
  }

  /**
   * Start periodic immutability validation
   * Runs every 30 seconds to detect violations
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.validationInterval) {
      this.stopMonitoring();
    }

    this.validationInterval = setInterval(() => {
      this.performValidation();
    }, intervalMs);

    console.log(`🛡️  Immutability guard started - validating every ${intervalMs}ms`);
  }

  /**
   * Stop periodic validation
   */
  stopMonitoring(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
      console.log('🛡️  Immutability guard stopped');
    }
  }

  /**
   * Perform immediate validation check
   */
  performValidation(): boolean {
    try {
      validateImmutability();
      this.lastValidation = new Date();
      return true;
    } catch (error) {
      this.violationCount++;
      this.handleViolation(error as Error);
      return false;
    }
  }

  /**
   * Handle immutability violation
   */
  private handleViolation(error: Error): void {
    const violation = {
      timestamp: new Date().toISOString(),
      error: error.message,
      violationNumber: this.violationCount,
      engineVersion: ENGINE_VERSION,
      severity: 'CRITICAL'
    };

    // Log the violation
    console.error('🚨 IMMUTABILITY VIOLATION DETECTED:', violation);

    // In production, this could trigger alerts, circuit breakers, etc.
    if (process.env.NODE_ENV === 'production') {
      // Throw error to stop execution in production
      throw new Error(
        `Critical immutability violation in production: ${error.message}. ` +
        `Engine must be restarted to ensure configuration integrity.`
      );
    }
  }

  /**
   * Create immutability checkpoint
   * Validates current state and returns a snapshot
   */
  createCheckpoint(): ImmutabilityCheckpoint {
    const isValid = this.performValidation();
    const status = getImmutabilityStatus();

    return {
      timestamp: new Date().toISOString(),
      isValid,
      violationCount: this.violationCount,
      lastValidation: this.lastValidation.toISOString(),
      status,
      engineVersion: ENGINE_VERSION
    };
  }

  /**
   * Validate against a previous checkpoint
   */
  validateCheckpoint(checkpoint: ImmutabilityCheckpoint): boolean {
    const current = this.createCheckpoint();
    
    // Check if violation count increased
    if (current.violationCount > checkpoint.violationCount) {
      throw new Error(
        `Immutability violations detected since checkpoint. ` +
        `Previous: ${checkpoint.violationCount}, Current: ${current.violationCount}`
      );
    }

    // Validate current state
    return current.isValid;
  }

  /**
   * Get guard statistics
   */
  getStatistics(): ImmutabilityStatistics {
    return {
      violationCount: this.violationCount,
      lastValidation: this.lastValidation.toISOString(),
      isMonitoring: this.validationInterval !== null,
      engineVersion: ENGINE_VERSION,
      uptime: process.uptime()
    };
  }

  /**
   * Reset violation counter (for testing)
   */
  resetViolationCount(): void {
    this.violationCount = 0;
  }
}

/**
 * Immutability checkpoint interface
 */
export interface ImmutabilityCheckpoint {
  timestamp: string;
  isValid: boolean;
  violationCount: number;
  lastValidation: string;
  status: unknown;
  engineVersion: string;
}

/**
 * Immutability statistics interface
 */
export interface ImmutabilityStatistics {
  violationCount: number;
  lastValidation: string;
  isMonitoring: boolean;
  engineVersion: string;
  uptime: number;
}

/**
 * Convenience function to start immutability monitoring
 */
export function startImmutabilityMonitoring(intervalMs?: number): ImmutabilityGuard {
  const guard = ImmutabilityGuard.getInstance();
  guard.startMonitoring(intervalMs);
  return guard;
}

/**
 * Convenience function to create an immutability checkpoint
 */
export function createImmutabilityCheckpoint(): ImmutabilityCheckpoint {
  const guard = ImmutabilityGuard.getInstance();
  return guard.createCheckpoint();
}