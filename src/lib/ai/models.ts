/**
 * OpenRouter FREE Model Configuration
 *
 * Weighted-decision-round-robin model selection for AI validation.
 * Top 15 FREE models on OpenRouter as of January 2026.
 * All models have $0 pricing - weighted by quality and reliability.
 *
 * @see https://openrouter.ai/collections/free-models
 */

export interface ModelConfig {
  id: string;                    // OpenRouter model ID (with :free suffix)
  name: string;                  // Human-readable name
  provider: string;              // Provider name
  weight: number;                // Selection weight (1-100, higher = more likely)
  contextWindow: number;         // Max context tokens
  tier: 'high' | 'mid' | 'base'; // Quality tier
  capabilities: ModelCapability[];
  enabled: boolean;              // Whether this model is active
  maxRetries: number;            // Max retries before fallback
  timeoutMs: number;             // Request timeout in milliseconds
}

export type ModelCapability =
  | 'reasoning'      // Strong logical reasoning
  | 'analysis'       // Data/price analysis
  | 'json'           // Reliable JSON output
  | 'fast'           // Low latency
  | 'vision'         // Image understanding
  | 'code';          // Code generation

/**
 * Top 15 FREE OpenRouter Models - January 2026
 *
 * Weights are calibrated for pricing anomaly validation:
 * - Higher weight for models with strong reasoning + JSON output
 * - All models are FREE ($0 cost)
 * - Adjusted for reliability based on provider track record
 *
 * Note: Free models may have rate limits during peak times.
 * The :free suffix indicates the free variant of the model.
 */
export const OPENROUTER_MODELS: ModelConfig[] = [
  // === HIGH TIER (Best quality free models) ===
  {
    id: 'google/gemini-2.5-flash-preview:free',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    weight: 25,  // Highest weight - excellent quality, 1M context
    contextWindow: 1048576,
    tier: 'high',
    capabilities: ['reasoning', 'analysis', 'json', 'fast', 'vision'],
    enabled: true,
    maxRetries: 3,
    timeoutMs: 20000,
  },
  {
    id: 'google/gemini-2.0-flash-lite-001:free',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'Google',
    weight: 22,  // Fast and reliable
    contextWindow: 1048576,
    tier: 'high',
    capabilities: ['reasoning', 'analysis', 'json', 'fast'],
    enabled: true,
    maxRetries: 3,
    timeoutMs: 15000,
  },
  {
    id: 'deepseek/deepseek-v3-base:free',
    name: 'DeepSeek V3 Base',
    provider: 'DeepSeek',
    weight: 24,  // Excellent reasoning, very capable
    contextWindow: 163840,
    tier: 'high',
    capabilities: ['reasoning', 'analysis', 'json', 'code'],
    enabled: true,
    maxRetries: 3,
    timeoutMs: 25000,
  },
  {
    id: 'deepseek/deepseek-r1-zero:free',
    name: 'DeepSeek R1 Zero',
    provider: 'DeepSeek',
    weight: 20,  // Strong reasoning model
    contextWindow: 163840,
    tier: 'high',
    capabilities: ['reasoning', 'analysis', 'json'],
    enabled: true,
    maxRetries: 3,
    timeoutMs: 30000,
  },
  {
    id: 'meta-llama/llama-4-maverick:free',
    name: 'Llama 4 Maverick',
    provider: 'Meta',
    weight: 22,  // Latest Llama 4, very capable
    contextWindow: 131072,
    tier: 'high',
    capabilities: ['reasoning', 'analysis', 'json', 'code'],
    enabled: true,
    maxRetries: 3,
    timeoutMs: 25000,
  },

  // === MID TIER (Good balance of quality and speed) ===
  {
    id: 'meta-llama/llama-4-scout:free',
    name: 'Llama 4 Scout',
    provider: 'Meta',
    weight: 18,  // Efficient Llama 4 variant
    contextWindow: 131072,
    tier: 'mid',
    capabilities: ['reasoning', 'analysis', 'json', 'fast'],
    enabled: true,
    maxRetries: 3,
    timeoutMs: 20000,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B Instruct',
    provider: 'Meta',
    weight: 20,  // Proven model, GPT-4 level performance
    contextWindow: 131072,
    tier: 'mid',
    capabilities: ['reasoning', 'analysis', 'json', 'code'],
    enabled: true,
    maxRetries: 3,
    timeoutMs: 25000,
  },
  {
    id: 'deepseek/deepseek-chat-v3-0324:free',
    name: 'DeepSeek Chat V3',
    provider: 'DeepSeek',
    weight: 18,  // Good chat model
    contextWindow: 163840,
    tier: 'mid',
    capabilities: ['reasoning', 'analysis', 'json'],
    enabled: true,
    maxRetries: 3,
    timeoutMs: 20000,
  },
  {
    id: 'mistralai/mistral-small-3.1-24b-instruct:free',
    name: 'Mistral Small 3.1 24B',
    provider: 'Mistral',
    weight: 16,  // Reliable Mistral model
    contextWindow: 131072,
    tier: 'mid',
    capabilities: ['reasoning', 'analysis', 'json', 'fast'],
    enabled: true,
    maxRetries: 3,
    timeoutMs: 18000,
  },
  {
    id: 'xiaomi/mimo-v2-flash:free',
    name: 'MiMo V2 Flash',
    provider: 'Xiaomi',
    weight: 15,  // MoE model, 309B total params
    contextWindow: 262144,
    tier: 'mid',
    capabilities: ['reasoning', 'analysis', 'json', 'code'],
    enabled: true,
    maxRetries: 3,
    timeoutMs: 20000,
  },

  // === BASE TIER (Lighter models, faster response) ===
  {
    id: 'mistralai/devstral-2512:free',
    name: 'Devstral 2512',
    provider: 'Mistral',
    weight: 14,  // Programming-focused
    contextWindow: 131072,
    tier: 'base',
    capabilities: ['analysis', 'json', 'code', 'fast'],
    enabled: true,
    maxRetries: 3,
    timeoutMs: 15000,
  },
  {
    id: 'qwen/qwen2.5-vl-72b-instruct:free',
    name: 'Qwen 2.5 VL 72B',
    provider: 'Alibaba',
    weight: 16,  // Strong multilingual + vision
    contextWindow: 131072,
    tier: 'base',
    capabilities: ['reasoning', 'analysis', 'json', 'vision'],
    enabled: true,
    maxRetries: 3,
    timeoutMs: 25000,
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct:free',
    name: 'Nemotron 70B',
    provider: 'NVIDIA',
    weight: 14,  // NVIDIA-tuned Llama
    contextWindow: 131072,
    tier: 'base',
    capabilities: ['reasoning', 'analysis', 'json'],
    enabled: true,
    maxRetries: 3,
    timeoutMs: 25000,
  },
  {
    id: 'nousresearch/deephermes-3-llama-3-8b-preview:free',
    name: 'DeepHermes 3 8B',
    provider: 'Nous Research',
    weight: 10,  // Lighter but capable
    contextWindow: 131072,
    tier: 'base',
    capabilities: ['reasoning', 'analysis', 'json', 'fast'],
    enabled: true,
    maxRetries: 3,
    timeoutMs: 15000,
  },
  {
    id: 'allenai/olmo-2-0325-32b-instruct:free',
    name: 'OLMo 2 32B',
    provider: 'AllenAI',
    weight: 12,  // Open research model
    contextWindow: 131072,
    tier: 'base',
    capabilities: ['reasoning', 'analysis', 'json'],
    enabled: true,
    maxRetries: 3,
    timeoutMs: 20000,
  },
];

/**
 * Model performance tracking for dynamic weight adjustment
 */
export interface ModelPerformance {
  modelId: string;
  successCount: number;
  failureCount: number;
  totalLatencyMs: number;
  lastUsed: Date;
  consecutiveFailures: number;
}

/**
 * Model selection state for weighted round-robin
 */
export interface ModelSelectionState {
  currentIndex: number;
  performances: Map<string, ModelPerformance>;
  lastRotation: Date;
}

/**
 * Get enabled models sorted by weight (descending)
 */
export function getEnabledModels(): ModelConfig[] {
  return OPENROUTER_MODELS
    .filter(m => m.enabled)
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Get model by ID
 */
export function getModelById(id: string): ModelConfig | undefined {
  return OPENROUTER_MODELS.find(m => m.id === id);
}

/**
 * Calculate effective weight based on performance history
 * Reduces weight for models with high failure rates
 */
export function calculateEffectiveWeight(
  model: ModelConfig,
  performance?: ModelPerformance
): number {
  if (!performance) {
    return model.weight;
  }

  const totalRequests = performance.successCount + performance.failureCount;
  if (totalRequests === 0) {
    return model.weight;
  }

  // Calculate success rate
  const successRate = performance.successCount / totalRequests;

  // Penalize models with consecutive failures (reduce weight by 10 per failure)
  const consecutiveFailurePenalty = Math.min(performance.consecutiveFailures * 10, 80);

  // Calculate effective weight (minimum 1)
  const effectiveWeight = Math.max(
    1,
    Math.round(model.weight * successRate) - consecutiveFailurePenalty
  );

  return effectiveWeight;
}

/**
 * Get total weight of all enabled models for probability calculation
 */
export function getTotalWeight(performances?: Map<string, ModelPerformance>): number {
  return getEnabledModels().reduce((sum, model) => {
    const perf = performances?.get(model.id);
    return sum + calculateEffectiveWeight(model, perf);
  }, 0);
}

/**
 * Get models by tier
 */
export function getModelsByTier(tier: ModelConfig['tier']): ModelConfig[] {
  return OPENROUTER_MODELS.filter(m => m.enabled && m.tier === tier);
}

/**
 * Get models with specific capability
 */
export function getModelsWithCapability(capability: ModelCapability): ModelConfig[] {
  return OPENROUTER_MODELS.filter(
    m => m.enabled && m.capabilities.includes(capability)
  );
}

/**
 * Default model selection state
 */
export function createDefaultSelectionState(): ModelSelectionState {
  return {
    currentIndex: 0,
    performances: new Map(),
    lastRotation: new Date(),
  };
}

/**
 * Get a summary of model costs (all FREE)
 */
export function getModelCostSummary(): string {
  return 'All 15 models are FREE ($0 cost) - using OpenRouter free tier';
}
