/**
 * OpenRouter Model Configuration
 *
 * Weighted-decision-round-robin model selection for AI validation and scraping.
 * Top 15 FREE models on OpenRouter as of January 2026 with tool-calling support.
 * Includes low-cost fallback models for tool-intensive operations.
 *
 * @see https://openrouter.ai/collections/free-models
 * @see https://openrouter.ai/docs/guides/features/tool-calling
 */

export interface ModelConfig {
  id: string;                    // OpenRouter model ID
  name: string;                  // Human-readable name
  provider: string;              // Provider name
  weight: number;                // Selection weight (1-100, higher = more likely)
  contextWindow: number;         // Max context tokens
  tier: 'high' | 'mid' | 'base'; // Quality tier
  capabilities: ModelCapability[];
  supportsTools: boolean;        // Whether model supports function/tool calling
  isFree: boolean;               // Whether model is free ($0 cost)
  costPer1kInput?: number;       // Cost per 1k input tokens (if not free)
  costPer1kOutput?: number;      // Cost per 1k output tokens (if not free)
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
  | 'code'           // Code generation
  | 'tools'          // Tool/function calling
  | 'agentic';       // Agentic workflows

/**
 * Top 15 FREE OpenRouter Models - January 2026
 *
 * Weights are calibrated for pricing anomaly validation and scraping:
 * - Higher weight for models with strong reasoning + tool support
 * - All primary models are FREE ($0 cost)
 * - Includes low-cost fallbacks for tool-intensive operations
 *
 * Note: Free models may have rate limits during peak times.
 * The :free suffix indicates the free variant of the model.
 */
export const OPENROUTER_MODELS: ModelConfig[] = [
  // === HIGH TIER (Best quality free models with tool support) ===
  {
    id: 'google/gemini-2.5-flash-preview:free',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    weight: 28,  // Highest weight - excellent quality, tool support, 1M context
    contextWindow: 1048576,
    tier: 'high',
    capabilities: ['reasoning', 'analysis', 'json', 'fast', 'vision', 'tools', 'agentic'],
    supportsTools: true,
    isFree: true,
    enabled: true,
    maxRetries: 3,
    timeoutMs: 25000,
  },
  {
    id: 'google/gemini-2.0-flash-001:free',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    weight: 26,  // Strong tool support, fast
    contextWindow: 1048576,
    tier: 'high',
    capabilities: ['reasoning', 'analysis', 'json', 'fast', 'vision', 'tools'],
    supportsTools: true,
    isFree: true,
    enabled: true,
    maxRetries: 3,
    timeoutMs: 20000,
  },
  {
    id: 'meta-llama/llama-4-maverick:free',
    name: 'Llama 4 Maverick',
    provider: 'Meta',
    weight: 24,  // Latest Llama 4, native tool support
    contextWindow: 131072,
    tier: 'high',
    capabilities: ['reasoning', 'analysis', 'json', 'code', 'tools', 'agentic'],
    supportsTools: true,
    isFree: true,
    enabled: true,
    maxRetries: 3,
    timeoutMs: 25000,
  },
  {
    id: 'qwen/qwen3-235b-a22b:free',
    name: 'Qwen 3 235B',
    provider: 'Alibaba',
    weight: 22,  // Excellent for agentic tasks
    contextWindow: 131072,
    tier: 'high',
    capabilities: ['reasoning', 'analysis', 'json', 'code', 'tools', 'agentic'],
    supportsTools: true,
    isFree: true,
    enabled: true,
    maxRetries: 3,
    timeoutMs: 30000,
  },
  {
    id: 'deepseek/deepseek-chat-v3-0324:free',
    name: 'DeepSeek Chat V3',
    provider: 'DeepSeek',
    weight: 22,  // Strong reasoning, good tool support
    contextWindow: 163840,
    tier: 'high',
    capabilities: ['reasoning', 'analysis', 'json', 'code', 'tools'],
    supportsTools: true,
    isFree: true,
    enabled: true,
    maxRetries: 3,
    timeoutMs: 25000,
  },

  // === MID TIER (Good balance of quality and speed with tool support) ===
  {
    id: 'meta-llama/llama-4-scout:free',
    name: 'Llama 4 Scout',
    provider: 'Meta',
    weight: 20,  // Efficient Llama 4 variant with tools
    contextWindow: 131072,
    tier: 'mid',
    capabilities: ['reasoning', 'analysis', 'json', 'fast', 'tools'],
    supportsTools: true,
    isFree: true,
    enabled: true,
    maxRetries: 3,
    timeoutMs: 20000,
  },
  {
    id: 'mistralai/mistral-small-3.1-24b-instruct:free',
    name: 'Mistral Small 3.1 24B',
    provider: 'Mistral',
    weight: 18,  // Reliable Mistral with function calling
    contextWindow: 131072,
    tier: 'mid',
    capabilities: ['reasoning', 'analysis', 'json', 'fast', 'tools'],
    supportsTools: true,
    isFree: true,
    enabled: true,
    maxRetries: 3,
    timeoutMs: 18000,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B Instruct',
    provider: 'Meta',
    weight: 18,  // Proven model with tool support
    contextWindow: 131072,
    tier: 'mid',
    capabilities: ['reasoning', 'analysis', 'json', 'code', 'tools'],
    supportsTools: true,
    isFree: true,
    enabled: true,
    maxRetries: 3,
    timeoutMs: 25000,
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct:free',
    name: 'Nemotron 70B',
    provider: 'NVIDIA',
    weight: 16,  // NVIDIA-tuned Llama with tool support
    contextWindow: 131072,
    tier: 'mid',
    capabilities: ['reasoning', 'analysis', 'json', 'tools'],
    supportsTools: true,
    isFree: true,
    enabled: true,
    maxRetries: 3,
    timeoutMs: 25000,
  },
  {
    id: 'thudm/glm-4-9b-chat:free',
    name: 'GLM-4 9B Chat',
    provider: 'Zhipu',
    weight: 14,  // Good for agentic applications
    contextWindow: 131072,
    tier: 'mid',
    capabilities: ['reasoning', 'analysis', 'json', 'fast', 'tools', 'agentic'],
    supportsTools: true,
    isFree: true,
    enabled: true,
    maxRetries: 3,
    timeoutMs: 18000,
  },

  // === BASE TIER (Reliable fallbacks with tool support) ===
  {
    id: 'qwen/qwen2.5-72b-instruct:free',
    name: 'Qwen 2.5 72B',
    provider: 'Alibaba',
    weight: 16,  // Strong multilingual + tools
    contextWindow: 131072,
    tier: 'base',
    capabilities: ['reasoning', 'analysis', 'json', 'tools'],
    supportsTools: true,
    isFree: true,
    enabled: true,
    maxRetries: 3,
    timeoutMs: 25000,
  },
  {
    id: 'mistralai/devstral-2512:free',
    name: 'Devstral 2512',
    provider: 'Mistral',
    weight: 14,  // Programming-focused with tool support
    contextWindow: 131072,
    tier: 'base',
    capabilities: ['analysis', 'json', 'code', 'fast', 'tools'],
    supportsTools: true,
    isFree: true,
    enabled: true,
    maxRetries: 3,
    timeoutMs: 15000,
  },
  {
    id: 'microsoft/phi-4:free',
    name: 'Phi-4',
    provider: 'Microsoft',
    weight: 12,  // Efficient small model with tools
    contextWindow: 16384,
    tier: 'base',
    capabilities: ['reasoning', 'analysis', 'json', 'fast', 'tools'],
    supportsTools: true,
    isFree: true,
    enabled: true,
    maxRetries: 3,
    timeoutMs: 15000,
  },

  // === LOW-COST FALLBACKS (For tool-intensive operations when free models fail) ===
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash (Paid)',
    provider: 'Google',
    weight: 20,  // Paid fallback with reliable tool support
    contextWindow: 1048576,
    tier: 'high',
    capabilities: ['reasoning', 'analysis', 'json', 'fast', 'vision', 'tools', 'agentic'],
    supportsTools: true,
    isFree: false,
    costPer1kInput: 0.00001,
    costPer1kOutput: 0.00004,
    enabled: true,
    maxRetries: 3,
    timeoutMs: 20000,
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
    weight: 18,  // Very reliable tool support, low cost
    contextWindow: 200000,
    tier: 'high',
    capabilities: ['reasoning', 'analysis', 'json', 'fast', 'tools', 'agentic'],
    supportsTools: true,
    isFree: false,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
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
  toolCallSuccessCount: number;
  toolCallFailureCount: number;
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
 * Get enabled FREE models only
 */
export function getFreeModels(): ModelConfig[] {
  return OPENROUTER_MODELS
    .filter(m => m.enabled && m.isFree)
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Get models that support tool/function calling
 */
export function getToolCapableModels(): ModelConfig[] {
  return OPENROUTER_MODELS
    .filter(m => m.enabled && m.supportsTools)
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Get FREE models that support tool calling
 */
export function getFreeToolCapableModels(): ModelConfig[] {
  return OPENROUTER_MODELS
    .filter(m => m.enabled && m.isFree && m.supportsTools)
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Get paid fallback models for tool calling
 */
export function getPaidToolFallbacks(): ModelConfig[] {
  return OPENROUTER_MODELS
    .filter(m => m.enabled && !m.isFree && m.supportsTools)
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

  // Bonus for good tool call success rate
  const toolCallTotal = performance.toolCallSuccessCount + performance.toolCallFailureCount;
  const toolCallBonus = toolCallTotal > 0
    ? Math.round((performance.toolCallSuccessCount / toolCallTotal) * 5)
    : 0;

  // Calculate effective weight (minimum 1)
  const effectiveWeight = Math.max(
    1,
    Math.round(model.weight * successRate) - consecutiveFailurePenalty + toolCallBonus
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
 * Get a summary of model costs
 */
export function getModelCostSummary(): string {
  const freeCount = getFreeModels().length;
  const paidCount = OPENROUTER_MODELS.filter(m => m.enabled && !m.isFree).length;
  return `${freeCount} FREE models + ${paidCount} low-cost fallbacks for tool-intensive operations`;
}

/**
 * Get models optimized for scraping with tool use
 */
export function getScrapingModels(): ModelConfig[] {
  return OPENROUTER_MODELS.filter(
    m => m.enabled &&
         m.supportsTools &&
         (m.capabilities.includes('agentic') || m.capabilities.includes('tools'))
  ).sort((a, b) => {
    // Prefer free models, then by weight
    if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
    return b.weight - a.weight;
  });
}
