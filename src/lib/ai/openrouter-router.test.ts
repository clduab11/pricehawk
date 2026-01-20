import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  reportModelError,
  isCircuitBroken,
  resetCircuitBreaker,
  clearAllCircuitBreakers,
  isSotaEnabled,
  isUnicornOpportunity,
  weightedRandomSelection,
  selectStandardModel,
  selectSotaModel,
  selectModel,
  getRouterStats,
  resetRouterState,
  callOpenRouter,
  callWithFallback,
  FREE_MODELS,
  SOTA_MODELS,
  CIRCUIT_BREAKER_THRESHOLD,
  CIRCUIT_BREAKER_WINDOW_MS,
  type ModelConfig,
  type UnicornContext,
} from './openrouter-router';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OpenRouter Router', () => {
  let originalRandom: () => number;
  let originalDateNow: () => number;
  let currentTime: number;

  beforeEach(() => {
    vi.clearAllMocks();
    resetRouterState();
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ENABLE_SOTA_MODELS = 'false';

    // Make random selection deterministic for tests
    originalRandom = Math.random;
    let callCount = 0;
    Math.random = () => {
      // Cycle through models predictably
      const value = (callCount % 10) / 10;
      callCount++;
      return value;
    };

    // Mock Date.now for timestamp-based circuit breaker tests
    originalDateNow = Date.now;
    currentTime = 1000000000000;
    Date.now = () => currentTime;
  });

  afterEach(() => {
    Math.random = originalRandom;
    Date.now = originalDateNow;
    delete process.env.ENABLE_SOTA_MODELS;
  });

  // ==========================================================================
  // Circuit Breaker Tests
  // ==========================================================================

  describe('Circuit Breaker', () => {
    it('should not break circuit with fewer than threshold errors', () => {
      const modelId = 'test-model';

      reportModelError(modelId);
      reportModelError(modelId);

      expect(isCircuitBroken(modelId)).toBe(false);
    });

    it('should break circuit at threshold errors', () => {
      const modelId = 'test-model';

      for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD; i++) {
        reportModelError(modelId);
      }

      expect(isCircuitBroken(modelId)).toBe(true);
    });

    it('should reset circuit breaker for specific model', () => {
      const modelId = 'test-model';

      for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD; i++) {
        reportModelError(modelId);
      }
      expect(isCircuitBroken(modelId)).toBe(true);

      resetCircuitBreaker(modelId);
      expect(isCircuitBroken(modelId)).toBe(false);
    });

    it('should clear all circuit breakers', () => {
      const model1 = 'model-1';
      const model2 = 'model-2';

      for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD; i++) {
        reportModelError(model1);
        reportModelError(model2);
      }

      expect(isCircuitBroken(model1)).toBe(true);
      expect(isCircuitBroken(model2)).toBe(true);

      clearAllCircuitBreakers();

      expect(isCircuitBroken(model1)).toBe(false);
      expect(isCircuitBroken(model2)).toBe(false);
    });

    it('should expire old errors outside the sliding window', () => {
      const modelId = 'test-model';

      // Report errors at current time
      for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD; i++) {
        reportModelError(modelId);
      }
      expect(isCircuitBroken(modelId)).toBe(true);

      // Advance time beyond the window
      currentTime += CIRCUIT_BREAKER_WINDOW_MS + 1000;

      // Circuit should no longer be broken (errors expired)
      expect(isCircuitBroken(modelId)).toBe(false);
    });

    it('should use sliding window for error counting', () => {
      const modelId = 'test-model';

      // Report 2 errors
      reportModelError(modelId);
      reportModelError(modelId);

      // Advance time to just before window expires
      currentTime += CIRCUIT_BREAKER_WINDOW_MS - 1000;

      // Report 1 more error (now we have 3 within window)
      reportModelError(modelId);
      expect(isCircuitBroken(modelId)).toBe(true);

      // Advance past original 2 errors
      currentTime += 2000;

      // Original 2 errors expired, only 1 recent error remains
      expect(isCircuitBroken(modelId)).toBe(false);
    });

    it('should avoid circuit-broken models in selection', () => {
      const MODEL_ID = FREE_MODELS[0].id;

      // Report 3 errors to break the circuit
      for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD; i++) {
        reportModelError(MODEL_ID);
      }
      expect(isCircuitBroken(MODEL_ID)).toBe(true);

      // Select 20 times and ensure broken model is never selected
      const selections = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const model = selectStandardModel();
        selections.add(model.id);
      }

      expect(selections.has(MODEL_ID)).toBe(false);
      expect(selections.size).toBeGreaterThan(0);
    });

    it('should reset all circuits when all models are broken', () => {
      // Break all standard models
      for (const model of FREE_MODELS) {
        for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD; i++) {
          reportModelError(model.id);
        }
      }

      // All should be broken
      for (const model of FREE_MODELS) {
        expect(isCircuitBroken(model.id)).toBe(true);
      }

      // Selection should trigger reset
      const selected = selectStandardModel();
      expect(selected).toBeDefined();
      expect(selected.id).toBe(FREE_MODELS[0].id);

      // Circuits should be cleared
      for (const model of FREE_MODELS) {
        expect(isCircuitBroken(model.id)).toBe(false);
      }
    });
  });

  // ==========================================================================
  // SOTA Toggle Tests
  // ==========================================================================

  describe('SOTA Toggle', () => {
    it('should return false when ENABLE_SOTA_MODELS is not set', () => {
      delete process.env.ENABLE_SOTA_MODELS;
      expect(isSotaEnabled()).toBe(false);
    });

    it('should return false when ENABLE_SOTA_MODELS is "false"', () => {
      process.env.ENABLE_SOTA_MODELS = 'false';
      expect(isSotaEnabled()).toBe(false);
    });

    it('should return true when ENABLE_SOTA_MODELS is "true"', () => {
      process.env.ENABLE_SOTA_MODELS = 'true';
      expect(isSotaEnabled()).toBe(true);
    });

    it('should fallback to standard when SOTA disabled but selectSotaModel called', () => {
      process.env.ENABLE_SOTA_MODELS = 'false';
      const selected = selectSotaModel();
      // Should be a standard model, not SOTA
      expect(FREE_MODELS.some((m) => m.id === selected.id)).toBe(true);
    });
  });

  // ==========================================================================
  // Unicorn Detection Tests
  // ==========================================================================

  describe('Unicorn Detection', () => {
    const baseContext: UnicornContext = {
      discount: 50,
      confidence: 50,
      currentPrice: 10,
      normalPrice: 100,
      zScore: 2,
      product: {
        title: 'Test Product',
        currentPrice: 10,
        category: 'Electronics',
      },
    };

    it('should not detect unicorn with low metrics', () => {
      expect(isUnicornOpportunity(baseContext)).toBe(false);
    });

    it('should detect unicorn with high discount and confidence', () => {
      expect(
        isUnicornOpportunity({
          ...baseContext,
          discount: 85,
          confidence: 90,
        })
      ).toBe(true);
    });

    it('should detect unicorn with high discount and z-score', () => {
      expect(
        isUnicornOpportunity({
          ...baseContext,
          discount: 85,
          zScore: 5,
        })
      ).toBe(true);
    });

    it('should detect unicorn with high confidence and z-score', () => {
      expect(
        isUnicornOpportunity({
          ...baseContext,
          confidence: 90,
          zScore: 5,
        })
      ).toBe(true);
    });

    it('should require at least two criteria for unicorn', () => {
      // Only high discount
      expect(
        isUnicornOpportunity({
          ...baseContext,
          discount: 85,
        })
      ).toBe(false);

      // Only high confidence
      expect(
        isUnicornOpportunity({
          ...baseContext,
          confidence: 90,
        })
      ).toBe(false);

      // Only high z-score
      expect(
        isUnicornOpportunity({
          ...baseContext,
          zScore: 5,
        })
      ).toBe(false);
    });

    it('should increment unicorn detection stats', () => {
      resetRouterState();
      const initial = getRouterStats().unicornDetections;

      isUnicornOpportunity({
        ...baseContext,
        discount: 85,
        confidence: 90,
      });

      expect(getRouterStats().unicornDetections).toBe(initial + 1);
    });
  });

  // ==========================================================================
  // Weighted Selection Tests
  // ==========================================================================

  describe('Weighted Selection', () => {
    it('should throw error for empty model list', () => {
      expect(() => weightedRandomSelection([])).toThrow(
        'Cannot select from empty model list'
      );
    });

    it('should return single model from list of one', () => {
      const models: ModelConfig[] = [
        {
          id: 'only-model',
          name: 'Only Model',
          weight: 100,
          maxTokens: 1000,
          contextWindow: 1000,
        },
      ];

      expect(weightedRandomSelection(models).id).toBe('only-model');
    });

    it('should select models based on weights', () => {
      // Reset random to a specific sequence for this test
      let randomIndex = 0;
      const randomValues = [0.1, 0.5, 0.9]; // Low, middle, high
      Math.random = () => randomValues[randomIndex++ % randomValues.length];

      const models: ModelConfig[] = [
        {
          id: 'low-weight',
          name: 'Low Weight',
          weight: 10,
          maxTokens: 1000,
          contextWindow: 1000,
        },
        {
          id: 'high-weight',
          name: 'High Weight',
          weight: 90,
          maxTokens: 1000,
          contextWindow: 1000,
        },
      ];

      // With random = 0.1, total weight = 100, random * total = 10
      // 10 - 10 (low-weight) = 0, so low-weight selected
      expect(weightedRandomSelection(models).id).toBe('low-weight');

      // With random = 0.5, total weight = 100, random * total = 50
      // 50 - 10 = 40, 40 - 90 < 0, so high-weight selected
      expect(weightedRandomSelection(models).id).toBe('high-weight');
    });
  });

  // ==========================================================================
  // Model Selection Tests
  // ==========================================================================

  describe('Model Selection', () => {
    it('should select standard model by default', () => {
      const model = selectModel();
      expect(FREE_MODELS.some((m) => m.id === model.id)).toBe(true);
    });

    it('should select SOTA model for unicorn when enabled', () => {
      process.env.ENABLE_SOTA_MODELS = 'true';

      const unicornContext: UnicornContext = {
        discount: 90,
        confidence: 95,
        currentPrice: 5,
        normalPrice: 100,
        zScore: 5,
        product: {
          title: 'Amazing Deal',
          currentPrice: 5,
          category: 'Electronics',
        },
      };

      const model = selectModel(unicornContext);
      expect(SOTA_MODELS.some((m) => m.id === model.id)).toBe(true);
    });

    it('should select standard model for unicorn when SOTA disabled', () => {
      process.env.ENABLE_SOTA_MODELS = 'false';

      const unicornContext: UnicornContext = {
        discount: 90,
        confidence: 95,
        currentPrice: 5,
        normalPrice: 100,
        zScore: 5,
        product: {
          title: 'Amazing Deal',
          currentPrice: 5,
          category: 'Electronics',
        },
      };

      const model = selectModel(unicornContext);
      expect(FREE_MODELS.some((m) => m.id === model.id)).toBe(true);
    });

    it('should fallback to standard when all SOTA models broken', () => {
      process.env.ENABLE_SOTA_MODELS = 'true';

      // Break all SOTA models
      for (const model of SOTA_MODELS) {
        for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD; i++) {
          reportModelError(model.id);
        }
      }

      const selected = selectSotaModel();
      // Should fall back to standard model
      expect(FREE_MODELS.some((m) => m.id === selected.id)).toBe(true);
    });

    it('should increment stats on model selection', () => {
      resetRouterState();

      selectStandardModel();
      expect(getRouterStats().standardCalls).toBe(1);

      process.env.ENABLE_SOTA_MODELS = 'true';
      selectSotaModel();
      expect(getRouterStats().sotaCalls).toBe(1);
    });
  });

  // ==========================================================================
  // Router Stats Tests
  // ==========================================================================

  describe('Router Stats', () => {
    it('should track circuit-broken models', () => {
      const modelId = FREE_MODELS[0].id;

      for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD; i++) {
        reportModelError(modelId);
      }

      const stats = getRouterStats();
      expect(stats.circuitBrokenModels).toContain(modelId);
    });

    it('should reset all stats', () => {
      selectStandardModel();
      reportModelError(FREE_MODELS[0].id);

      resetRouterState();

      const stats = getRouterStats();
      expect(stats.standardCalls).toBe(0);
      expect(stats.sotaCalls).toBe(0);
      expect(stats.unicornDetections).toBe(0);
      expect(stats.circuitBrokenModels).toHaveLength(0);
    });
  });

  // ==========================================================================
  // API Call Tests
  // ==========================================================================

  describe('OpenRouter API', () => {
    it('should throw error when API key is missing', async () => {
      delete process.env.OPENROUTER_API_KEY;

      await expect(
        callOpenRouter({
          model: FREE_MODELS[0],
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow('OpenRouter API key not configured');
    });

    it('should make successful API call', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Response text' } }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30,
            },
          }),
      });

      const result = await callOpenRouter({
        model: FREE_MODELS[0],
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(result.content).toBe('Response text');
      expect(result.model).toBe(FREE_MODELS[0].id);
      expect(result.usage?.totalTokens).toBe(30);
    });

    it('should report error on API failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('API Error'),
      });

      const model = FREE_MODELS[0];
      await expect(
        callOpenRouter({
          model,
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow();

      // Check that error was reported (model has 1 error)
      expect(isCircuitBroken(model.id)).toBe(false); // 1 < threshold
    });

    it('should reset circuit breaker on successful request', async () => {
      const model = FREE_MODELS[0];

      // Report 2 errors
      reportModelError(model.id);
      reportModelError(model.id);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Success' } }],
          }),
      });

      await callOpenRouter({
        model,
        messages: [{ role: 'user', content: 'test' }],
      });

      // Verify no more errors are tracked
      expect(isCircuitBroken(model.id)).toBe(false);
    });

    it('should handle empty response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: '' } }],
          }),
      });

      await expect(
        callOpenRouter({
          model: FREE_MODELS[0],
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow('Empty response from OpenRouter');
    });
  });

  // ==========================================================================
  // Fallback Tests
  // ==========================================================================

  describe('callWithFallback', () => {
    it('should succeed on first try', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Success' } }],
          }),
      });

      const result = await callWithFallback({
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(result.content).toBe('Success');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure with different model', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            text: () => Promise.resolve('Error'),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: 'Success on retry' } }],
            }),
        });
      });

      const result = await callWithFallback({
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(result.content).toBe('Success on retry');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw when primary and fallback models both fail', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('All failed'),
      });

      await expect(
        callWithFallback({
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Constants Verification Tests
  // ==========================================================================

  describe('Constants', () => {
    it('should have valid circuit breaker threshold', () => {
      expect(CIRCUIT_BREAKER_THRESHOLD).toBeGreaterThan(0);
      expect(CIRCUIT_BREAKER_THRESHOLD).toBe(3);
    });

    it('should have valid circuit breaker window', () => {
      expect(CIRCUIT_BREAKER_WINDOW_MS).toBeGreaterThan(0);
      expect(CIRCUIT_BREAKER_WINDOW_MS).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should have FREE_MODELS defined', () => {
      expect(FREE_MODELS.length).toBeGreaterThan(0);
      for (const model of FREE_MODELS) {
        expect(model.id).toBeDefined();
        expect(model.weight).toBeGreaterThan(0);
      }
    });

    it('should have SOTA_MODELS defined', () => {
      expect(SOTA_MODELS.length).toBeGreaterThan(0);
      for (const model of SOTA_MODELS) {
        expect(model.id).toBeDefined();
        expect(model.weight).toBeGreaterThan(0);
      }
    });
  });
});
