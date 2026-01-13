/**
 * Phase 2 Decision Engine - Structured Logger
 * 
 * Winston-based structured logging with security features, performance monitoring,
 * and specialized logging methods for decision events, provider failures, and performance warnings.
 */

import winston from 'winston';
import { maskSensitiveData } from '../config/index';
import { LOG_LEVELS } from '../constants/gates';
import { DecisionOutput, ENGINE_VERSION, DecisionContext } from '../types';

export interface DecisionLogEvent {
  type: 'DECISION_EVENT';
  engineVersion: string;
  decision: 'APPROVE' | 'REJECT';
  context: DecisionContext;
  output: DecisionOutput;
  processingTime: number;
  timestamp: string;
}

export interface ProviderFailureEvent {
  type: 'PROVIDER_ERROR';
  provider: string;
  error: string;
  timeout?: number;
  fallbackUsed: boolean;
  timestamp: string;
}

export interface PerformanceWarningEvent {
  type: 'PERFORMANCE_WARNING';
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timestamp: string;
}

export interface RequestEvent {
  type: 'REQUEST_EVENT';
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  ip: string;
  userAgent?: string;
  requestId: string;
  timestamp: string;
}

export class Logger {
  private logger: winston.Logger;

  constructor(level: string = 'info') {
    this.logger = winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(this.formatMessage.bind(this))
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  private formatMessage(info: unknown): string {
    // Mask sensitive data before logging
    const masked = maskSensitiveData(info) as any;
    
    return JSON.stringify({
      timestamp: masked.timestamp,
      level: masked.level,
      message: masked.message,
      ...masked
    });
  }

  public info(message: string, meta?: unknown): void {
    this.logger.info(message, meta);
  }

  public warn(message: string, meta?: unknown): void {
    this.logger.warn(message, meta);
  }

  public error(message: string, meta?: unknown): void {
    this.logger.error(message, meta);
  }

  public debug(message: string, meta?: unknown): void {
    this.logger.debug(message, meta);
  }

  public setLevel(level: string): void {
    this.logger.level = level;
  }

  /**
   * Log structured decision events with complete context
   * Requirement 20.1: Log structured decision events with all context
   */
  public logDecisionEvent(
    context: DecisionContext,
    output: DecisionOutput,
    processingTime: number
  ): void {
    const event: DecisionLogEvent = {
      type: 'DECISION_EVENT',
      engineVersion: ENGINE_VERSION,
      decision: output.decision,
      context: this.sanitizeContext(context),
      output: this.sanitizeOutput(output),
      processingTime,
      timestamp: new Date().toISOString()
    };

    this.info('Decision completed', event);
  }

  /**
   * Log provider failure events with error details
   * Requirement 20.2: Log provider failure events with error details
   */
  public logProviderFailure(
    provider: string,
    error: string,
    timeout?: number,
    fallbackUsed: boolean = true
  ): void {
    const event: ProviderFailureEvent = {
      type: 'PROVIDER_ERROR',
      provider,
      error,
      timeout,
      fallbackUsed,
      timestamp: new Date().toISOString()
    };

    this.warn(`Provider error - using fallback ${provider} ${error}`, {
      context: event
    });
  }

  /**
   * Log performance warning events when thresholds exceeded
   * Requirement 20.3: Log performance warnings when thresholds exceeded
   */
  public logPerformanceWarning(
    metric: string,
    value: number,
    threshold: number,
    severity: 'warning' | 'critical' = 'warning'
  ): void {
    const event: PerformanceWarningEvent = {
      type: 'PERFORMANCE_WARNING',
      metric,
      value,
      threshold,
      severity,
      timestamp: new Date().toISOString()
    };

    const message = `Performance ${severity}: ${metric} = ${value} (threshold: ${threshold})`;
    
    if (severity === 'critical') {
      this.error(message, { context: event });
    } else {
      this.warn(message, { context: event });
    }
  }

  /**
   * Log request events with context
   */
  public logRequestEvent(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    ip: string,
    requestId: string,
    userAgent?: string
  ): void {
    const event: RequestEvent = {
      type: 'REQUEST_EVENT',
      method,
      path,
      statusCode,
      responseTime,
      ip,
      userAgent,
      requestId,
      timestamp: new Date().toISOString()
    };

    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const message = `${method} ${path} ${statusCode} ${responseTime}ms`;

    this.logger.log(level, message, { context: event });
  }

  /**
   * Log error events with stack traces and request context
   * Requirement 20.4: Log error events with stack traces and request context
   */
  public logError(
    message: string,
    error: Error,
    requestContext?: {
      method?: string;
      path?: string;
      ip?: string;
      requestId?: string;
      body?: unknown;
    }
  ): void {
    const errorEvent = {
      type: 'ERROR_EVENT',
      message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      requestContext: requestContext ? this.sanitizeRequestContext(requestContext) : undefined,
      timestamp: new Date().toISOString()
    };

    this.error(message, errorEvent);
  }

  /**
   * Sanitize decision context to remove sensitive data
   */
  private sanitizeContext(context: DecisionContext): DecisionContext {
    // Create a deep copy and mask sensitive fields
    const sanitized = JSON.parse(JSON.stringify(context));
    
    // Remove any potential sensitive data from signal metadata
    if (sanitized.signal && sanitized.signal.metadata) {
      sanitized.signal.metadata = maskSensitiveData(sanitized.signal.metadata);
    }
    
    return sanitized;
  }

  /**
   * Sanitize decision output to remove sensitive data
   */
  private sanitizeOutput(output: DecisionOutput): DecisionOutput {
    // Create a deep copy and mask sensitive fields
    const sanitized = JSON.parse(JSON.stringify(output));
    
    // Mask any sensitive data in audit trail
    if (sanitized.audit && sanitized.audit.context) {
      sanitized.audit.context = maskSensitiveData(sanitized.audit.context);
    }
    
    return sanitized;
  }

  /**
   * Sanitize request context to remove sensitive data
   */
  private sanitizeRequestContext(context: unknown): unknown {
    const sanitized = { ...(context as any) };
    
    // Mask request body if present
    if (sanitized.body) {
      sanitized.body = maskSensitiveData(sanitized.body);
    }
    
    return sanitized;
  }

  /**
   * Create a child logger with additional context
   */
  public child(context: unknown): Logger {
    const childLogger = new Logger(this.logger.level);
    
    // Add context to all log messages
    const originalFormatMessage = childLogger.formatMessage.bind(childLogger);
    childLogger.formatMessage = (info: unknown) => {
      return originalFormatMessage({
        ...(info as any),
        ...(maskSensitiveData(context) as any)
      });
    };
    
    return childLogger;
  }
}