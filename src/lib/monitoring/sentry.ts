/**
 * Sentry Error Tracking Integration (Stub Implementation)
 * 
 * Provides centralized error tracking and monitoring for production.
 * Configure SENTRY_DSN environment variable to enable.
 * 
 * IMPORTANT: This is a stub implementation that logs errors locally.
 * For production use, install the official Sentry SDK:
 * 
 *   npm install @sentry/node
 * 
 * Then replace this file with actual SDK integration:
 *   import * as Sentry from '@sentry/node';
 *   Sentry.init({ dsn: process.env.SENTRY_DSN });
 *   export const sentry = Sentry;
 * 
 * The current implementation provides:
 * - Same interface as the real SDK for easy migration
 * - Local logging of errors for development
 * - Error buffering before initialization
 * - No external dependencies
 * 
 * @see https://docs.sentry.io/platforms/node/
 */

interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
}

interface ErrorContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  user?: {
    id?: string;
    email?: string;
  };
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
}

/**
 * Sentry integration service
 * 
 * Note: This is a lightweight implementation that can be extended
 * with the full @sentry/node SDK when ready for production.
 * Currently implements the interface without the actual SDK dependency
 * to avoid adding unnecessary build complexity during development.
 */
class SentryService {
  private initialized = false;
  private config: SentryConfig | null = null;
  private errorBuffer: Array<{ error: Error; context: ErrorContext }> = [];

  /**
   * Initialize Sentry with configuration
   */
  init(): void {
    const dsn = process.env.SENTRY_DSN;
    
    if (!dsn) {
      console.log('[Sentry] No DSN configured, error tracking disabled');
      return;
    }

    this.config = {
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || process.env.npm_package_version,
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    };

    this.initialized = true;
    console.log(`[Sentry] Initialized for environment: ${this.config.environment}`);

    // Flush any buffered errors
    this.flushBuffer();
  }

  /**
   * Capture and report an error
   */
  captureException(error: Error, context: ErrorContext = {}): string {
    const eventId = this.generateEventId();

    if (!this.initialized) {
      // Buffer errors until Sentry is initialized
      this.errorBuffer.push({ error, context });
      console.error('[Sentry] Error captured (buffered):', error.message);
      return eventId;
    }

    this.sendError(error, context, eventId);
    return eventId;
  }

  /**
   * Capture a message (non-error event)
   */
  captureMessage(message: string, level: ErrorContext['level'] = 'info', context: ErrorContext = {}): string {
    const eventId = this.generateEventId();

    if (!this.initialized) {
      console.log(`[Sentry] Message captured (${level}): ${message}`);
      return eventId;
    }

    this.sendMessage(message, level, context, eventId);
    return eventId;
  }

  /**
   * Set user context for error tracking
   */
  setUser(user: ErrorContext['user']): void {
    if (!this.initialized) return;
    console.log('[Sentry] User context set:', user?.id);
  }

  /**
   * Add breadcrumb for debugging context
   */
  addBreadcrumb(breadcrumb: {
    category: string;
    message: string;
    level?: 'debug' | 'info' | 'warning' | 'error';
    data?: Record<string, unknown>;
  }): void {
    if (!this.initialized) return;
    console.log(`[Sentry] Breadcrumb: [${breadcrumb.category}] ${breadcrumb.message}`);
  }

  /**
   * Start a performance transaction
   */
  startTransaction(name: string, op: string): SentryTransaction {
    return new SentryTransaction(name, op, this.initialized);
  }

  /**
   * Check if Sentry is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  private sendError(error: Error, context: ErrorContext, eventId: string): void {
    const payload = this.buildPayload(error, context, eventId);
    
    // Log error details (in production, this would send to Sentry API)
    console.error(`[Sentry] Error reported (${eventId}):`, {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      ...context,
    });

    // TODO: When @sentry/node is added, replace with actual API call:
    // Sentry.captureException(error, { ...context, eventId });
  }

  private sendMessage(message: string, level: ErrorContext['level'], context: ErrorContext, eventId: string): void {
    console.log(`[Sentry] Message reported (${level}, ${eventId}): ${message}`);
  }

  private buildPayload(error: Error, context: ErrorContext, eventId: string): Record<string, unknown> {
    return {
      eventId,
      timestamp: new Date().toISOString(),
      environment: this.config?.environment,
      release: this.config?.release,
      exception: {
        type: error.name,
        value: error.message,
        stacktrace: error.stack,
      },
      ...context,
    };
  }

  private flushBuffer(): void {
    while (this.errorBuffer.length > 0) {
      const item = this.errorBuffer.shift();
      if (item) {
        this.sendError(item.error, item.context, this.generateEventId());
      }
    }
  }

  private generateEventId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}

/**
 * Performance transaction for tracing
 */
class SentryTransaction {
  private startTime: number;
  private spans: Map<string, { startTime: number; description: string }> = new Map();

  constructor(
    private name: string,
    private op: string,
    private enabled: boolean
  ) {
    this.startTime = Date.now();
    if (enabled) {
      console.log(`[Sentry] Transaction started: ${op}/${name}`);
    }
  }

  startSpan(description: string): string {
    const spanId = Math.random().toString(36).substring(2, 10);
    this.spans.set(spanId, { startTime: Date.now(), description });
    return spanId;
  }

  finishSpan(spanId: string): void {
    const span = this.spans.get(spanId);
    if (span && this.enabled) {
      const duration = Date.now() - span.startTime;
      console.log(`[Sentry] Span finished: ${span.description} (${duration}ms)`);
    }
    this.spans.delete(spanId);
  }

  finish(): void {
    const duration = Date.now() - this.startTime;
    if (this.enabled) {
      console.log(`[Sentry] Transaction finished: ${this.op}/${this.name} (${duration}ms)`);
    }
  }

  setStatus(status: 'ok' | 'error' | 'cancelled'): void {
    if (this.enabled) {
      console.log(`[Sentry] Transaction status: ${status}`);
    }
  }
}

// Singleton instance
export const sentry = new SentryService();

// Helper function for wrapping async functions with error tracking
export function withSentry<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context: ErrorContext = {}
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof Error) {
        sentry.captureException(error, context);
      }
      throw error;
    }
  }) as T;
}
