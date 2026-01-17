/**
 * Weighted Decision Round-Robin Model Selector
 *
 * Selects models from the OpenRouter free tier using a weighted round-robin
 * algorithm that balances load across models while preferring higher-weighted
 * (higher quality) models.
 *
 * Features:
 * - Weighted probability selection based on model quality
 * - Dynamic weight adjustment based on performance history
 * - Automatic failover to next model on errors
 * - Circuit breaker pattern for consistently failing models
 * - Redis-backed state persistence for distributed deployments
 */

import {
  ModelConfig,
  ModelPerformance,
  ModelSelectionState,
  OPENROUTER_MODELS,
  getEnabledModels,
  calculateEffectiveWeight,
  createDefaultSelectionState,
} from './models';

// Redis key for persisting selector state
const SELECTOR_STATE_KEY = 'ai:model:selector:state';
const PERFORMANCE_KEY_PREFIX = 'ai:model:performance:';
const CIRCUIT_BREAKER_KEY_PREFIX = 'ai:model:circuit:';

// Circuit breaker settings
const CIRCUIT_BREAKER_THRESHOLD = 5; // failures before opening circuit
const CIRCUIT_BREAKER_RESET_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Model selector with weighted round-robin and performance tracking
 */
export class WeightedModelSelector {
  private state: ModelSelectionState;
  private redis: RedisClient | null = null;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  constructor() {
    this.state = createDefaultSelectionState();
  }

  /**
   * Initialize with Redis for distributed state (optional)
   */
  async initialize(redis?: RedisClient): Promise<void> {
    this.redis = redis || null;

    if (this.redis) {
      await this.loadStateFromRedis();
    }
  }

  /**
   * Select the next model using weighted round-robin
   * Returns the selected model and its effective weight
   */
  async selectModel(): Promise<{ model: ModelConfig; effectiveWeight: number }> {
    const enabledModels = getEnabledModels();

    if (enabledModels.length === 0) {
      throw new Error('No enabled models available');
    }

    // Filter out models with open circuit breakers
    const availableModels = enabledModels.filter(
      model => !this.isCircuitOpen(model.id)
    );

    if (availableModels.length === 0) {
      // All circuits are open - reset the oldest one and use it
      console.warn('All model circuits are open, resetting oldest circuit');
      const oldestModel = this.resetOldestCircuit();
      if (oldestModel) {
        return {
          model: oldestModel,
          effectiveWeight: calculateEffectiveWeight(
            oldestModel,
            this.state.performances.get(oldestModel.id)
          ),
        };
      }
      // Fallback to first enabled model
      return {
        model: enabledModels[0],
        effectiveWeight: enabledModels[0].weight,
      };
    }

    // Calculate total effective weight
    const totalWeight = availableModels.reduce((sum, model) => {
      const perf = this.state.performances.get(model.id);
      return sum + calculateEffectiveWeight(model, perf);
    }, 0);

    // Select model using weighted random selection
    const randomValue = Math.random() * totalWeight;
    let cumulativeWeight = 0;
    let selectedModel: ModelConfig = availableModels[0];

    for (const model of availableModels) {
      const perf = this.state.performances.get(model.id);
      const effectiveWeight = calculateEffectiveWeight(model, perf);
      cumulativeWeight += effectiveWeight;

      if (randomValue <= cumulativeWeight) {
        selectedModel = model;
        break;
      }
    }

    // Update state
    this.state.lastRotation = new Date();

    // Persist state if Redis is available
    if (this.redis) {
      await this.saveStateToRedis();
    }

    const effectiveWeight = calculateEffectiveWeight(
      selectedModel,
      this.state.performances.get(selectedModel.id)
    );

    return { model: selectedModel, effectiveWeight };
  }

  /**
   * Select next model after a failure (for retry/fallback)
   * Excludes the failed model from selection
   */
  async selectFallbackModel(excludeModelId: string): Promise<ModelConfig | null> {
    const enabledModels = getEnabledModels();
    const availableModels = enabledModels.filter(
      model => model.id !== excludeModelId && !this.isCircuitOpen(model.id)
    );

    if (availableModels.length === 0) {
      return null;
    }

    // Use weighted selection for fallback
    const totalWeight = availableModels.reduce((sum, model) => {
      const perf = this.state.performances.get(model.id);
      return sum + calculateEffectiveWeight(model, perf);
    }, 0);

    const randomValue = Math.random() * totalWeight;
    let cumulativeWeight = 0;

    for (const model of availableModels) {
      const perf = this.state.performances.get(model.id);
      cumulativeWeight += calculateEffectiveWeight(model, perf);

      if (randomValue <= cumulativeWeight) {
        return model;
      }
    }

    return availableModels[0];
  }

  /**
   * Record a successful request for a model
   */
  async recordSuccess(modelId: string, latencyMs: number): Promise<void> {
    const perf = this.getOrCreatePerformance(modelId);
    perf.successCount++;
    perf.totalLatencyMs += latencyMs;
    perf.lastUsed = new Date();
    perf.consecutiveFailures = 0;

    // Close circuit breaker on success
    this.closeCircuit(modelId);

    if (this.redis) {
      await this.savePerformanceToRedis(modelId, perf);
    }
  }

  /**
   * Record a failed request for a model
   */
  async recordFailure(modelId: string, error?: Error): Promise<void> {
    const perf = this.getOrCreatePerformance(modelId);
    perf.failureCount++;
    perf.lastUsed = new Date();
    perf.consecutiveFailures++;

    // Check if circuit breaker should open
    if (perf.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.openCircuit(modelId);
      console.warn(
        `Circuit breaker opened for model ${modelId} after ${perf.consecutiveFailures} consecutive failures`
      );
    }

    if (this.redis) {
      await this.savePerformanceToRedis(modelId, perf);
    }
  }

  /**
   * Get performance metrics for a model
   */
  getPerformance(modelId: string): ModelPerformance | undefined {
    return this.state.performances.get(modelId);
  }

  /**
   * Get all performance metrics
   */
  getAllPerformances(): Map<string, ModelPerformance> {
    return new Map(this.state.performances);
  }

  /**
   * Get statistics about model usage
   */
  getStats(): ModelSelectorStats {
    const enabledModels = getEnabledModels();
    let totalSuccess = 0;
    let totalFailure = 0;
    let totalLatency = 0;
    const modelStats: ModelStats[] = [];

    for (const model of enabledModels) {
      const perf = this.state.performances.get(model.id);
      const effectiveWeight = calculateEffectiveWeight(model, perf);
      const circuitState = this.circuitBreakers.get(model.id);

      modelStats.push({
        modelId: model.id,
        name: model.name,
        provider: model.provider,
        baseWeight: model.weight,
        effectiveWeight,
        successCount: perf?.successCount || 0,
        failureCount: perf?.failureCount || 0,
        toolCallSuccessCount: perf?.toolCallSuccessCount || 0,
        toolCallFailureCount: perf?.toolCallFailureCount || 0,
        avgLatencyMs: perf && perf.successCount > 0
          ? Math.round(perf.totalLatencyMs / perf.successCount)
          : 0,
        circuitState: circuitState?.state || 'closed',
        lastUsed: perf?.lastUsed || null,
        supportsTools: model.supportsTools,
        isFree: model.isFree,
      });

      if (perf) {
        totalSuccess += perf.successCount;
        totalFailure += perf.failureCount;
        totalLatency += perf.totalLatencyMs;
      }
    }

    const totalRequests = totalSuccess + totalFailure;

    return {
      totalModels: enabledModels.length,
      availableModels: enabledModels.filter(m => !this.isCircuitOpen(m.id)).length,
      totalRequests,
      totalSuccess,
      totalFailure,
      successRate: totalRequests > 0 ? totalSuccess / totalRequests : 1,
      avgLatencyMs: totalSuccess > 0 ? Math.round(totalLatency / totalSuccess) : 0,
      modelStats,
    };
  }

  /**
   * Reset all performance metrics
   */
  async resetStats(): Promise<void> {
    this.state = createDefaultSelectionState();
    this.circuitBreakers.clear();

    if (this.redis) {
      await this.redis.del(SELECTOR_STATE_KEY);
      // Delete all performance keys
      for (const model of OPENROUTER_MODELS) {
        await this.redis.del(`${PERFORMANCE_KEY_PREFIX}${model.id}`);
        await this.redis.del(`${CIRCUIT_BREAKER_KEY_PREFIX}${model.id}`);
      }
    }
  }

  // === Private methods ===

  /**
   * Record a successful tool call for a model
   */
  async recordToolCallSuccess(modelId: string): Promise<void> {
    const perf = this.getOrCreatePerformance(modelId);
    perf.toolCallSuccessCount++;

    if (this.redis) {
      await this.savePerformanceToRedis(modelId, perf);
    }
  }

  /**
   * Record a failed tool call for a model
   */
  async recordToolCallFailure(modelId: string): Promise<void> {
    const perf = this.getOrCreatePerformance(modelId);
    perf.toolCallFailureCount++;

    if (this.redis) {
      await this.savePerformanceToRedis(modelId, perf);
    }
  }

  private getOrCreatePerformance(modelId: string): ModelPerformance {
    let perf = this.state.performances.get(modelId);
    if (!perf) {
      perf = {
        modelId,
        successCount: 0,
        failureCount: 0,
        totalLatencyMs: 0,
        lastUsed: new Date(),
        consecutiveFailures: 0,
        toolCallSuccessCount: 0,
        toolCallFailureCount: 0,
      };
      this.state.performances.set(modelId, perf);
    }
    return perf;
  }

  private isCircuitOpen(modelId: string): boolean {
    const circuit = this.circuitBreakers.get(modelId);
    if (!circuit || circuit.state === 'closed') {
      return false;
    }

    // Check if circuit should be half-open (reset time passed)
    if (circuit.state === 'open') {
      const elapsed = Date.now() - circuit.openedAt.getTime();
      if (elapsed >= CIRCUIT_BREAKER_RESET_MS) {
        circuit.state = 'half-open';
        return false; // Allow one request through
      }
    }

    return circuit.state === 'open';
  }

  private openCircuit(modelId: string): void {
    this.circuitBreakers.set(modelId, {
      modelId,
      state: 'open',
      openedAt: new Date(),
      failureCount: CIRCUIT_BREAKER_THRESHOLD,
    });
  }

  private closeCircuit(modelId: string): void {
    const circuit = this.circuitBreakers.get(modelId);
    if (circuit) {
      circuit.state = 'closed';
      circuit.failureCount = 0;
    }
  }

  private resetOldestCircuit(): ModelConfig | null {
    let oldestCircuit: CircuitBreakerState | null = null;
    let oldestModel: ModelConfig | null = null;

    for (const [modelId, circuit] of this.circuitBreakers) {
      if (circuit.state === 'open') {
        if (!oldestCircuit || circuit.openedAt < oldestCircuit.openedAt) {
          oldestCircuit = circuit;
          const model = OPENROUTER_MODELS.find(m => m.id === modelId);
          if (model) {
            oldestModel = model;
          }
        }
      }
    }

    if (oldestCircuit) {
      oldestCircuit.state = 'half-open';
    }

    return oldestModel;
  }

  private async loadStateFromRedis(): Promise<void> {
    if (!this.redis) return;

    try {
      // Load performances for each model
      for (const model of OPENROUTER_MODELS) {
        const perfJson = await this.redis.get(`${PERFORMANCE_KEY_PREFIX}${model.id}`);
        if (perfJson) {
          const perf = JSON.parse(perfJson) as ModelPerformance;
          perf.lastUsed = new Date(perf.lastUsed);
          this.state.performances.set(model.id, perf);
        }

        const circuitJson = await this.redis.get(`${CIRCUIT_BREAKER_KEY_PREFIX}${model.id}`);
        if (circuitJson) {
          const circuit = JSON.parse(circuitJson) as CircuitBreakerState;
          circuit.openedAt = new Date(circuit.openedAt);
          this.circuitBreakers.set(model.id, circuit);
        }
      }
    } catch (error) {
      console.error('Failed to load model selector state from Redis:', error);
    }
  }

  private async saveStateToRedis(): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.set(
        SELECTOR_STATE_KEY,
        JSON.stringify({
          currentIndex: this.state.currentIndex,
          lastRotation: this.state.lastRotation.toISOString(),
        }),
        { ex: 86400 } // 24 hour TTL
      );
    } catch (error) {
      console.error('Failed to save model selector state to Redis:', error);
    }
  }

  private async savePerformanceToRedis(modelId: string, perf: ModelPerformance): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.set(
        `${PERFORMANCE_KEY_PREFIX}${modelId}`,
        JSON.stringify(perf),
        { ex: 86400 } // 24 hour TTL
      );

      const circuit = this.circuitBreakers.get(modelId);
      if (circuit) {
        await this.redis.set(
          `${CIRCUIT_BREAKER_KEY_PREFIX}${modelId}`,
          JSON.stringify(circuit),
          { ex: 86400 }
        );
      }
    } catch (error) {
      console.error('Failed to save model performance to Redis:', error);
    }
  }
}

// === Types ===

interface CircuitBreakerState {
  modelId: string;
  state: 'closed' | 'open' | 'half-open';
  openedAt: Date;
  failureCount: number;
}

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

interface ModelStats {
  modelId: string;
  name: string;
  provider: string;
  baseWeight: number;
  effectiveWeight: number;
  successCount: number;
  failureCount: number;
  toolCallSuccessCount: number;
  toolCallFailureCount: number;
  avgLatencyMs: number;
  circuitState: 'closed' | 'open' | 'half-open';
  lastUsed: Date | null;
  supportsTools: boolean;
  isFree: boolean;
}

interface ModelSelectorStats {
  totalModels: number;
  availableModels: number;
  totalRequests: number;
  totalSuccess: number;
  totalFailure: number;
  successRate: number;
  avgLatencyMs: number;
  modelStats: ModelStats[];
}

// === Singleton instance ===

let selectorInstance: WeightedModelSelector | null = null;

/**
 * Get the singleton model selector instance
 */
export function getModelSelector(): WeightedModelSelector {
  if (!selectorInstance) {
    selectorInstance = new WeightedModelSelector();
  }
  return selectorInstance;
}

/**
 * Initialize the model selector with Redis (call once at app startup)
 */
export async function initializeModelSelector(redis?: RedisClient): Promise<WeightedModelSelector> {
  const selector = getModelSelector();
  await selector.initialize(redis);
  return selector;
}

export type { ModelStats, ModelSelectorStats, CircuitBreakerState };
