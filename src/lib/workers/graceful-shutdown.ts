/**
 * Graceful Shutdown Handler for Workers
 * 
 * Provides unified graceful shutdown handling for all worker processes.
 * Workers can register cleanup callbacks that will be executed before
 * the process terminates.
 * 
 * Features:
 * - Configurable shutdown timeout (default: 30 seconds)
 * - Multiple cleanup callback support
 * - Signal handling (SIGTERM, SIGINT)
 * - Forced exit after timeout
 */

type CleanupCallback = () => Promise<void>;

interface ShutdownConfig {
  /** Maximum time to wait for cleanup in milliseconds (default: 30000) */
  timeout: number;
  /** Worker name for logging */
  workerName: string;
}

class GracefulShutdown {
  private callbacks: CleanupCallback[] = [];
  private isShuttingDown = false;
  private config: ShutdownConfig;

  constructor(config: Partial<ShutdownConfig> = {}) {
    this.config = {
      timeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '30000'),
      workerName: process.env.WORKER_TYPE || 'unknown-worker',
      ...config,
    };

    this.setupSignalHandlers();
  }

  /**
   * Register a cleanup callback to be executed during shutdown
   */
  onShutdown(callback: CleanupCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Check if shutdown is in progress
   */
  isInShutdown(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Trigger graceful shutdown manually
   */
  async shutdown(reason: string = 'manual'): Promise<void> {
    if (this.isShuttingDown) {
      console.log(`[${this.config.workerName}] Shutdown already in progress`);
      return;
    }

    this.isShuttingDown = true;
    console.log(`[${this.config.workerName}] 🛑 Graceful shutdown initiated (${reason})`);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Shutdown timeout exceeded'));
      }, this.config.timeout);
    });

    try {
      // Execute all cleanup callbacks
      const cleanupPromise = this.executeCleanup();
      await Promise.race([cleanupPromise, timeoutPromise]);
      
      console.log(`[${this.config.workerName}] ✅ Graceful shutdown complete`);
      process.exit(0);
    } catch (error) {
      console.error(`[${this.config.workerName}] ⚠️ Shutdown timeout or error, forcing exit:`, error);
      process.exit(1);
    }
  }

  private async executeCleanup(): Promise<void> {
    console.log(`[${this.config.workerName}] Executing ${this.callbacks.length} cleanup callbacks...`);
    
    for (let i = 0; i < this.callbacks.length; i++) {
      try {
        console.log(`[${this.config.workerName}] Running cleanup callback ${i + 1}/${this.callbacks.length}`);
        await this.callbacks[i]();
      } catch (error) {
        console.error(`[${this.config.workerName}] Cleanup callback ${i + 1} failed:`, error);
      }
    }
  }

  private setupSignalHandlers(): void {
    // Handle SIGTERM (docker stop, Kubernetes, Railway)
    process.on('SIGTERM', () => {
      console.log(`[${this.config.workerName}] Received SIGTERM`);
      this.shutdown('SIGTERM');
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      console.log(`[${this.config.workerName}] Received SIGINT`);
      this.shutdown('SIGINT');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error(`[${this.config.workerName}] Uncaught exception:`, error);
      this.shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error(`[${this.config.workerName}] Unhandled rejection at:`, promise, 'reason:', reason);
      // Don't shutdown on unhandled rejections, just log
    });
  }
}

/**
 * Create a graceful shutdown handler for a worker
 */
export function createGracefulShutdown(config?: Partial<ShutdownConfig>): GracefulShutdown {
  return new GracefulShutdown(config);
}

/**
 * Sleep utility that respects shutdown state
 */
export function sleepWithShutdownCheck(
  ms: number, 
  shutdownHandler: GracefulShutdown
): Promise<boolean> {
  return new Promise((resolve) => {
    const checkInterval = Math.min(ms, 1000);
    let elapsed = 0;

    const check = setInterval(() => {
      elapsed += checkInterval;
      
      if (shutdownHandler.isInShutdown()) {
        clearInterval(check);
        resolve(false); // Interrupted by shutdown
        return;
      }
      
      if (elapsed >= ms) {
        clearInterval(check);
        resolve(true); // Completed normally
      }
    }, checkInterval);
  });
}

export type { GracefulShutdown, ShutdownConfig, CleanupCallback };
