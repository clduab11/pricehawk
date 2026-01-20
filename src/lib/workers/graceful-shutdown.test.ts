import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGracefulShutdown, sleepWithShutdownCheck } from './graceful-shutdown';

describe('GracefulShutdown', () => {
  beforeEach(() => {
    // Mock process.on to prevent actual signal handlers
    vi.spyOn(process, 'on').mockImplementation(() => process);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createGracefulShutdown', () => {
    it('should create a shutdown handler with default config', () => {
      const shutdown = createGracefulShutdown();
      
      expect(shutdown).toBeDefined();
      expect(shutdown.isInShutdown()).toBe(false);
    });

    it('should create a shutdown handler with custom config', () => {
      const shutdown = createGracefulShutdown({
        workerName: 'test-worker',
        timeout: 10000,
      });
      
      expect(shutdown).toBeDefined();
      expect(shutdown.isInShutdown()).toBe(false);
    });

    it('should allow registering cleanup callbacks', () => {
      const shutdown = createGracefulShutdown();
      const cleanup1 = vi.fn().mockResolvedValue(undefined);
      const cleanup2 = vi.fn().mockResolvedValue(undefined);
      
      shutdown.onShutdown(cleanup1);
      shutdown.onShutdown(cleanup2);
      
      // Callbacks are stored but not executed yet
      expect(cleanup1).not.toHaveBeenCalled();
      expect(cleanup2).not.toHaveBeenCalled();
    });
  });

  describe('isInShutdown', () => {
    it('should return false initially', () => {
      const shutdown = createGracefulShutdown();
      expect(shutdown.isInShutdown()).toBe(false);
    });
  });

  describe('sleepWithShutdownCheck', () => {
    it('should complete normally when not in shutdown', async () => {
      const shutdown = createGracefulShutdown();
      
      const start = Date.now();
      const result = await sleepWithShutdownCheck(100, shutdown);
      const elapsed = Date.now() - start;
      
      expect(result).toBe(true);
      // Allow some timing tolerance
      expect(elapsed).toBeGreaterThanOrEqual(90);
    });

    it('should return false if shutdown is initiated during sleep', async () => {
      const shutdown = createGracefulShutdown();
      
      // Override exit to prevent actual process exit
      vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      
      // Start sleeping - this returns a promise
      const sleepPromise = sleepWithShutdownCheck(5000, shutdown);
      
      // Trigger shutdown after a short delay
      // The shutdown.shutdown() call will change the state that sleepWithShutdownCheck checks
      await new Promise((resolve) => setTimeout(resolve, 50));
      void shutdown.shutdown('test'); // Fire and forget - don't await
      
      const result = await sleepPromise;
      
      expect(result).toBe(false);
    });

    it('should check shutdown state at intervals', async () => {
      const shutdown = createGracefulShutdown();
      
      // This should complete in multiple check intervals
      const start = Date.now();
      const result = await sleepWithShutdownCheck(250, shutdown);
      const elapsed = Date.now() - start;
      
      expect(result).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(250);
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('signal handlers', () => {
    it('should register signal handlers on creation', () => {
      const onSpy = vi.spyOn(process, 'on');
      
      createGracefulShutdown();
      
      // Check that SIGTERM and SIGINT handlers are registered
      const calls = onSpy.mock.calls.map(call => call[0]);
      expect(calls).toContain('SIGTERM');
      expect(calls).toContain('SIGINT');
      expect(calls).toContain('uncaughtException');
      expect(calls).toContain('unhandledRejection');
    });
  });
});
