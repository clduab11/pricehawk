/**
 * OpenRouter Model Router
 *
 * Implements intelligent model selection with:
 * - Weighted random selection across free-tier models
 * - Circuit breaker pattern for failing models (timestamp-based, serverless-safe)
 * - SOTA model routing for "unicorn" opportunities
 * - Health-based fallback logic
 */

// =============================================================================
// Types
// =============================================================================

export interface ModelConfig {
  id: string;
  name: string;
  weight: number; // Higher weight = more likely to be selected
  maxTokens: number;
  contextWindow: number;
}

export interface UnicornContext {
  discount: number;
  confidence: number;
  currentPrice: number;
  normalPrice: number;
  zScore?: number;
  product: {
    title: string;
    currentPrice: number;
    category?: string;
  };
}

export type ModelErrorState = {
  timestamps: number[]; // Array of error timestamps
};

export type RouterState = {
  errorCounts: Map<string, ModelErrorState>;
  stats: {
    standardCalls: number;
    sotaCalls: number;
    unicornDetections: number;
  };
};

// =============================================================================
// Constants
// =============================================================================

export const CIRCUIT_BREAKER_THRESHOLD = 3;
export const CIRCUIT_BREAKER_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_FALLBACK_ATTEMPTS = 3;

// Free-tier models available on OpenRouter
export const FREE_MODELS: ModelConfig[] = [
  {
    id: 'google/gemini-flash-1.5-8b',
    name: 'Gemini Flash 1.5 8B',
    weight: 30, // Primary model - good balance of speed and quality
    maxTokens: 8192,
    contextWindow: 1000000,
  },
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    name: 'Llama 3.2 3B Instruct',
    weight: 25,
    maxTokens: 8192,
    contextWindow: 131072,
  },
  {
    id: 'qwen/qwen-2.5-7b-instruct:free',
    name: 'Qwen 2.5 7B Instruct',
    weight: 20,
    maxTokens: 8192,
    contextWindow: 32768,
  },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    name: 'Mistral 7B Instruct',
    weight: 15,
    maxTokens: 8192,
    contextWindow: 32768,
  },
  {
    id: 'huggingfaceh4/zephyr-7b-beta:free',
    name: 'Zephyr 7B Beta',
    weight: 10,
    maxTokens: 4096,
    contextWindow: 4096,
  },
];

// SOTA (State of the Art) models for high-value opportunities
export const SOTA_MODELS: ModelConfig[] = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    weight: 40,
    maxTokens: 8192,
    contextWindow: 200000,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    weight: 35,
    maxTokens: 16384,
    contextWindow: 128000,
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    weight: 25,
    maxTokens: 8192,
    contextWindow: 64000,
  },
];

// Unicorn detection thresholds
const UNICORN_DISCOUNT_THRESHOLD = 80; // >80% discount
const UNICORN_CONFIDENCE_THRESHOLD = 85; // >85% initial confidence
const UNICORN_ZSCORE_THRESHOLD = 4; // Z-score > 4

// =============================================================================
// State (module-level, resets on cold start - appropriate for serverless)
// =============================================================================

const state: RouterState = {
  errorCounts: new Map<string, ModelErrorState>(),
  stats: {
    standardCalls: 0,
    sotaCalls: 0,
    unicornDetections: 0,
  },
};

// =============================================================================
// Circuit Breaker (Timestamp-based, serverless-safe)
// =============================================================================

/**
 * Report an error for a model. Uses timestamp-based tracking for serverless compatibility.
 */
export function reportModelError(modelId: string): void {
  const now = Date.now();
  const existing = state.errorCounts.get(modelId);

  if (existing) {
    // Filter out errors older than the circuit breaker window
    const recentErrors = existing.timestamps.filter(
      (ts) => now - ts < CIRCUIT_BREAKER_WINDOW_MS
    );
    recentErrors.push(now);
    state.errorCounts.set(modelId, { timestamps: recentErrors });
  } else {
    state.errorCounts.set(modelId, { timestamps: [now] });
  }

  console.log(
    `[OpenRouter] Model ${modelId} error reported. Recent errors: ${state.errorCounts.get(modelId)?.timestamps.length || 0}`
  );
}

/**
 * Check if a model's circuit breaker is tripped.
 * Returns true if the model has >= CIRCUIT_BREAKER_THRESHOLD errors in the sliding window.
 */
export function isCircuitBroken(modelId: string): boolean {
  const now = Date.now();
  const existing = state.errorCounts.get(modelId);

  if (!existing) return false;

  // Count only recent errors within the sliding window
  const recentErrors = existing.timestamps.filter(
    (ts) => now - ts < CIRCUIT_BREAKER_WINDOW_MS
  );

  // Update state to clean up old timestamps
  if (recentErrors.length === 0) {
    state.errorCounts.delete(modelId);
    return false;
  }

  state.errorCounts.set(modelId, { timestamps: recentErrors });
  return recentErrors.length >= CIRCUIT_BREAKER_THRESHOLD;
}

/**
 * Reset a model's circuit breaker (e.g., after successful request).
 */
export function resetCircuitBreaker(modelId: string): void {
  state.errorCounts.delete(modelId);
}

/**
 * Clear all circuit breakers (used when all models are broken).
 */
export function clearAllCircuitBreakers(): void {
  state.errorCounts.clear();
  console.log('[OpenRouter] All circuit breakers cleared');
}

// =============================================================================
// SOTA Toggle
// =============================================================================

/**
 * Check if SOTA models are enabled via environment variable.
 */
export function isSotaEnabled(): boolean {
  return process.env.ENABLE_SOTA_MODELS === 'true';
}

// =============================================================================
// Unicorn Detection
// =============================================================================

/**
 * Determine if an opportunity qualifies as a "unicorn" (exceptional deal).
 * Unicorns are rare, high-value opportunities that warrant SOTA model analysis.
 */
export function isUnicornOpportunity(context: UnicornContext): boolean {
  const { discount, confidence, zScore } = context;

  // Must meet at least two criteria to be a unicorn
  let criteriaMet = 0;

  if (discount >= UNICORN_DISCOUNT_THRESHOLD) criteriaMet++;
  if (confidence >= UNICORN_CONFIDENCE_THRESHOLD) criteriaMet++;
  if (zScore !== undefined && zScore >= UNICORN_ZSCORE_THRESHOLD) criteriaMet++;

  const isUnicorn = criteriaMet >= 2;

  if (isUnicorn) {
    state.stats.unicornDetections++;
    console.log(
      `[OpenRouter] 🦄 Unicorn detected! Discount: ${discount}%, Confidence: ${confidence}%, Z-Score: ${zScore}`
    );
  }

  return isUnicorn;
}

// =============================================================================
// Weighted Selection
// =============================================================================

/**
 * Perform weighted random selection from a list of models.
 * Higher weight = higher probability of selection.
 */
export function weightedRandomSelection(models: ModelConfig[]): ModelConfig {
  if (models.length === 0) {
    throw new Error('Cannot select from empty model list');
  }

  if (models.length === 1) {
    return models[0];
  }

  const totalWeight = models.reduce((sum, model) => sum + model.weight, 0);
  let random = Math.random() * totalWeight;

  for (const model of models) {
    random -= model.weight;
    if (random <= 0) {
      return model;
    }
  }

  // Fallback to last model (should never reach here with proper weights)
  return models[models.length - 1];
}

// =============================================================================
// Model Selection
// =============================================================================

/**
 * Select a standard (free-tier) model, filtering out circuit-broken models.
 */
export function selectStandardModel(): ModelConfig {
  // Filter out circuit-broken models before selection
  const healthyModels = FREE_MODELS.filter((m) => !isCircuitBroken(m.id));

  if (healthyModels.length === 0) {
    // All models broken - log warning and reset circuit breakers
    console.warn(
      '[OpenRouter] All standard models circuit-broken, resetting...'
    );
    clearAllCircuitBreakers();
    return FREE_MODELS[0];
  }

  const selected = weightedRandomSelection(healthyModels);
  state.stats.standardCalls++;

  console.log(`[OpenRouter] Selected standard model: ${selected.name}`);
  return selected;
}

/**
 * Select a SOTA (premium) model, filtering out circuit-broken models.
 * Falls back to standard tier if all SOTA models are broken.
 */
export function selectSotaModel(): ModelConfig {
  // Additional safety check
  if (!isSotaEnabled()) {
    console.warn(
      '[OpenRouter] SOTA disabled but selectSotaModel called, falling back to standard'
    );
    return selectStandardModel();
  }

  const healthyModels = SOTA_MODELS.filter((m) => !isCircuitBroken(m.id));

  if (healthyModels.length === 0) {
    console.warn(
      '[OpenRouter] All SOTA models circuit-broken, falling back to standard tier'
    );
    return selectStandardModel();
  }

  const selected = weightedRandomSelection(healthyModels);
  state.stats.sotaCalls++;

  console.log(`[OpenRouter] Selected SOTA model: ${selected.name}`);
  return selected;
}

/**
 * Main entry point for model selection.
 * Automatically routes to SOTA models for unicorn opportunities (if enabled).
 */
export function selectModel(context?: UnicornContext): ModelConfig {
  // Gate SOTA selection at the earliest point
  if (context && isSotaEnabled() && isUnicornOpportunity(context)) {
    console.log('[OpenRouter] 🦄 Unicorn detected! Routing to SOTA model');
    return selectSotaModel();
  }

  return selectStandardModel();
}

// =============================================================================
// Stats & Debugging
// =============================================================================

/**
 * Get current router statistics.
 */
export function getRouterStats(): RouterState['stats'] & {
  circuitBrokenModels: string[];
} {
  const circuitBrokenModels = [
    ...FREE_MODELS.map((m) => m.id),
    ...SOTA_MODELS.map((m) => m.id),
  ].filter((id) => isCircuitBroken(id));

  return {
    ...state.stats,
    circuitBrokenModels,
  };
}

/**
 * Reset all router state (for testing).
 */
export function resetRouterState(): void {
  state.errorCounts.clear();
  state.stats.standardCalls = 0;
  state.stats.sotaCalls = 0;
  state.stats.unicornDetections = 0;
}

// =============================================================================
// OpenRouter API Helper
// =============================================================================

export interface OpenRouterRequestOptions {
  model: ModelConfig;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' } | { type: 'text' };
}

export interface OpenRouterResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Make a request to OpenRouter with the selected model.
 * Automatically handles errors and reports them to the circuit breaker.
 */
export async function callOpenRouter(
  options: OpenRouterRequestOptions
): Promise<OpenRouterResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const { model, messages, temperature = 0.1, maxTokens, responseFormat } = options;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'pricehawk',
      },
      body: JSON.stringify({
        model: model.id,
        messages,
        temperature,
        max_tokens: maxTokens || model.maxTokens,
        ...(responseFormat && { response_format: responseFormat }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenRouter] API Error (${model.id}): ${response.status} - ${errorText}`);
      reportModelError(model.id);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      console.error(`[OpenRouter] API Error (${model.id}):`, data.error.message);
      reportModelError(model.id);
      throw new Error(data.error.message);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      reportModelError(model.id);
      throw new Error('Empty response from OpenRouter');
    }

    // Success - reset circuit breaker for this model
    resetCircuitBreaker(model.id);

    return {
      content,
      model: model.id,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  } catch (error) {
    // Report error if not already reported
    if (error instanceof Error && !error.message.includes('OpenRouter')) {
      reportModelError(model.id);
    }
    throw error;
  }
}

/**
 * Make a request with automatic fallback to next healthy model.
 */
export async function callWithFallback(
  options: Omit<OpenRouterRequestOptions, 'model'>,
  context?: UnicornContext
): Promise<OpenRouterResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_FALLBACK_ATTEMPTS; attempt++) {
    const model = selectModel(context);

    try {
      return await callOpenRouter({ ...options, model });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[OpenRouter] Attempt ${attempt + 1}/${MAX_FALLBACK_ATTEMPTS} failed with ${model.id}: ${lastError.message}`
      );
    }
  }

  throw lastError || new Error('All fallback attempts failed');
}
