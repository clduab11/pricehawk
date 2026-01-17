/**
 * AI-Powered Scraping Agent
 *
 * Uses OpenRouter models with tool/function calling to intelligently
 * orchestrate scraping across Firecrawl, Tavily, and Jina.ai providers.
 *
 * Features:
 * - Agentic tool selection based on task requirements
 * - Weighted round-robin model selection for reliability
 * - Automatic fallback between providers
 * - Structured data extraction with validation
 *
 * @see https://openrouter.ai/docs/guides/features/tool-calling
 */

import { ModelConfig, getScrapingModels, getPaidToolFallbacks } from './models';
import { getModelSelector } from './model-selector';

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// ============================================================================
// Tool Definitions for Scraping
// ============================================================================

/**
 * Tool definitions following OpenAI's function calling schema
 * These are passed to OpenRouter which standardizes them across providers
 */
const SCRAPING_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'scrape_url_firecrawl',
      description: 'Scrape a product URL using Firecrawl. Best for direct product pages with structured data extraction. Handles anti-bot measures and JavaScript rendering.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The full product URL to scrape (e.g., https://amazon.com/dp/B09V3K...)',
          },
          wait_for_selector: {
            type: 'string',
            description: 'Optional CSS selector to wait for before scraping (e.g., ".price-block")',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_tavily',
      description: 'Search for products or deals using Tavily web search. Best for discovering products, finding deals across retailers, or searching for pricing information.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (e.g., "iPhone 15 Pro price deal Amazon Walmart")',
          },
          include_domains: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of domains to include (e.g., ["amazon.com", "walmart.com"])',
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_url_jina',
      description: 'Read and convert a URL to markdown using Jina Reader. Best for extracting clean text content, handling complex pages, or as a fallback when Firecrawl fails.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to read and convert to markdown',
          },
          target_selector: {
            type: 'string',
            description: 'Optional CSS selector to target specific content',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'extract_product_data',
      description: 'Extract structured product data from raw text/markdown content. Use this after scraping to get price, title, and other product details.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The raw text or markdown content from a scraped page',
          },
          url: {
            type: 'string',
            description: 'The source URL (for retailer detection)',
          },
        },
        required: ['content', 'url'],
      },
    },
  },
];

// ============================================================================
// Types
// ============================================================================

export interface ScrapingTask {
  type: 'scrape_url' | 'search_deals' | 'verify_price' | 'discover_products';
  url?: string;
  query?: string;
  productName?: string;
  expectedPrice?: number;
  retailers?: string[];
}

export interface ScrapingResult {
  success: boolean;
  data?: {
    product_name?: string;
    current_price?: number;
    original_price?: number;
    currency?: string;
    stock_status?: string;
    image_url?: string;
    category?: string;
    retailer?: string;
    url?: string;
    raw_content?: string;
  };
  toolsUsed: string[];
  modelUsed: string;
  latencyMs: number;
  error?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// ============================================================================
// Tool Execution
// ============================================================================

/**
 * Execute a tool call and return the result
 */
async function executeTool(toolName: string, args: Record<string, unknown>): Promise<string> {
  switch (toolName) {
    case 'scrape_url_firecrawl':
      return await executeFirecrawlScrape(args.url as string, args.wait_for_selector as string | undefined);

    case 'search_tavily':
      return await executeTavilySearch(
        args.query as string,
        args.include_domains as string[] | undefined,
        args.max_results as number | undefined
      );

    case 'read_url_jina':
      return await executeJinaRead(args.url as string, args.target_selector as string | undefined);

    case 'extract_product_data':
      return await executeProductExtraction(args.content as string, args.url as string);

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

/**
 * Execute Firecrawl scraping
 */
async function executeFirecrawlScrape(url: string, waitForSelector?: string): Promise<string> {
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

  if (!FIRECRAWL_API_KEY) {
    return JSON.stringify({ success: false, error: 'Firecrawl API key not configured' });
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'json'],
        waitFor: 2000,
        ...(waitForSelector && { waitForSelector }),
        extract: {
          schema: {
            type: 'object',
            properties: {
              product_name: { type: 'string' },
              current_price: { type: 'number' },
              original_price: { type: 'number' },
              stock_status: { type: 'string' },
              image_url: { type: 'string' },
              category: { type: 'string' },
            },
            required: ['product_name', 'current_price'],
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return JSON.stringify({ success: false, error: `Firecrawl API error: ${error}` });
    }

    const result = await response.json();
    return JSON.stringify({
      success: true,
      data: result.data?.llm_extraction || {},
      markdown: result.data?.markdown?.substring(0, 5000), // Truncate for context
      metadata: result.data?.metadata,
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Firecrawl error',
    });
  }
}

/**
 * Execute Tavily search
 */
async function executeTavilySearch(
  query: string,
  includeDomains?: string[],
  maxResults?: number
): Promise<string> {
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

  if (!TAVILY_API_KEY) {
    return JSON.stringify({ success: false, error: 'Tavily API key not configured' });
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        max_results: maxResults || 10,
        include_domains: includeDomains || [
          'amazon.com', 'walmart.com', 'target.com', 'bestbuy.com',
          'costco.com', 'homedepot.com', 'lowes.com', 'newegg.com',
        ],
      }),
    });

    if (!response.ok) {
      return JSON.stringify({ success: false, error: `Tavily API error: ${response.status}` });
    }

    const data = await response.json();
    return JSON.stringify({
      success: true,
      results: data.results?.slice(0, 10).map((r: { title: string; url: string; content: string; score: number }) => ({
        title: r.title,
        url: r.url,
        content: r.content?.substring(0, 500),
        score: r.score,
      })),
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Tavily error',
    });
  }
}

/**
 * Execute Jina Reader
 */
async function executeJinaRead(url: string, targetSelector?: string): Promise<string> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-Return-Format': 'markdown',
    };

    if (process.env.JINA_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;
    }

    if (targetSelector) {
      headers['X-Target-Selector'] = targetSelector;
    }

    const response = await fetch(`https://r.jina.ai/${url}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      return JSON.stringify({ success: false, error: `Jina API error: ${response.status}` });
    }

    const data = await response.json();
    return JSON.stringify({
      success: true,
      title: data.data?.title,
      content: data.data?.content?.substring(0, 8000), // Truncate for context
      url: data.data?.url,
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Jina error',
    });
  }
}

/**
 * Extract product data from content (AI-assisted extraction)
 */
async function executeProductExtraction(content: string, url: string): Promise<string> {
  // Extract retailer from URL
  let retailer = 'unknown';
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('amazon')) retailer = 'amazon';
    else if (hostname.includes('walmart')) retailer = 'walmart';
    else if (hostname.includes('target')) retailer = 'target';
    else if (hostname.includes('bestbuy')) retailer = 'bestbuy';
    else if (hostname.includes('costco')) retailer = 'costco';
    else retailer = hostname.replace('www.', '').split('.')[0];
  } catch {
    // Ignore URL parsing errors
  }

  // Extract prices using regex patterns
  const pricePatterns = [
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
    /USD\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /(?:price|cost|sale)[\s:]*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
  ];

  const prices: number[] = [];
  for (const pattern of pricePatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const priceStr = match[1].replace(/,/g, '');
      const price = parseFloat(priceStr);
      if (!isNaN(price) && price > 0 && price < 100000) {
        prices.push(price);
      }
    }
  }

  // Sort prices and identify current/original
  prices.sort((a, b) => a - b);
  const uniquePrices = [...new Set(prices)];

  const currentPrice = uniquePrices[0] || null;
  const originalPrice = uniquePrices.length > 1 ? uniquePrices[uniquePrices.length - 1] : null;

  // Extract title (first substantial text line)
  const lines = content.split('\n').filter(l => l.trim().length > 10);
  const title = lines[0]?.trim().substring(0, 200) || 'Unknown Product';

  // Check stock status
  const stockKeywords = {
    in_stock: ['in stock', 'available', 'add to cart', 'buy now'],
    out_of_stock: ['out of stock', 'unavailable', 'sold out', 'currently unavailable'],
    limited: ['limited', 'few left', 'only'],
  };

  let stockStatus = 'unknown';
  const lowerContent = content.toLowerCase();
  for (const [status, keywords] of Object.entries(stockKeywords)) {
    if (keywords.some(k => lowerContent.includes(k))) {
      stockStatus = status;
      break;
    }
  }

  return JSON.stringify({
    success: true,
    extracted: {
      product_name: title,
      current_price: currentPrice,
      original_price: originalPrice,
      stock_status: stockStatus,
      retailer,
      url,
    },
  });
}

// ============================================================================
// Agent System Prompt
// ============================================================================

const SCRAPING_AGENT_SYSTEM_PROMPT = `You are an intelligent web scraping agent for PriceHawk, a pricing error detection platform.

Your goal is to efficiently extract product pricing data from e-commerce websites using the available tools.

## Available Tools
1. **scrape_url_firecrawl** - Primary scraper for direct product URLs. Use this first for product pages.
2. **search_tavily** - Web search for discovering products or deals. Use when you need to find products or compare prices.
3. **read_url_jina** - Fallback URL reader. Use when Firecrawl fails or for simpler pages.
4. **extract_product_data** - Extract structured data from raw content. Use after getting page content.

## Strategy
1. For direct product URLs: Try Firecrawl first, fallback to Jina if it fails
2. For product searches: Use Tavily to discover relevant URLs, then scrape them
3. Always extract and validate product data before returning
4. Look for: product name, current price, original price, stock status

## Response Format
After gathering data, provide a final JSON response with:
{
  "product_name": "Product Title",
  "current_price": 99.99,
  "original_price": 149.99,
  "currency": "USD",
  "stock_status": "in_stock",
  "retailer": "amazon",
  "confidence": 0.95
}

Be efficient - use the minimum number of tool calls needed.`;

// ============================================================================
// Main Scraping Agent
// ============================================================================

/**
 * AI-powered scraping agent that uses tool calling to orchestrate providers
 */
export class ScrapingAgent {
  private maxIterations = 5;

  /**
   * Execute a scraping task using the AI agent
   */
  async execute(task: ScrapingTask): Promise<ScrapingResult> {
    if (!OPENROUTER_API_KEY) {
      return {
        success: false,
        error: 'OpenRouter API key not configured',
        toolsUsed: [],
        modelUsed: 'none',
        latencyMs: 0,
      };
    }

    const startTime = Date.now();
    const toolsUsed: string[] = [];
    let modelUsed = 'unknown';

    // Build the initial user message based on task type
    const userMessage = this.buildTaskMessage(task);

    // Get a model that supports tools
    const models = getScrapingModels();
    const fallbacks = getPaidToolFallbacks();
    const allModels = [...models, ...fallbacks];

    if (allModels.length === 0) {
      return {
        success: false,
        error: 'No tool-capable models available',
        toolsUsed: [],
        modelUsed: 'none',
        latencyMs: Date.now() - startTime,
      };
    }

    // Try models until one succeeds
    let lastError: string | null = null;

    for (const model of allModels.slice(0, 3)) { // Try up to 3 models
      try {
        const result = await this.runAgentLoop(model, userMessage, toolsUsed);
        modelUsed = model.name;

        if (result.success) {
          // Record success
          const selector = getModelSelector();
          await selector.recordSuccess(model.id, Date.now() - startTime);

          return {
            ...result,
            toolsUsed,
            modelUsed,
            latencyMs: Date.now() - startTime,
          };
        }

        lastError = result.error || 'Unknown error';
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Agent error';
        const selector = getModelSelector();
        await selector.recordFailure(model.id);
      }
    }

    return {
      success: false,
      error: lastError || 'All models failed',
      toolsUsed,
      modelUsed,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Build the task message for the agent
   */
  private buildTaskMessage(task: ScrapingTask): string {
    switch (task.type) {
      case 'scrape_url':
        return `Scrape product data from this URL: ${task.url}\n\nExtract the product name, current price, original price (if discounted), stock status, and any other relevant product information.`;

      case 'search_deals':
        return `Search for deals on: ${task.query || task.productName}\n\n${task.retailers ? `Focus on these retailers: ${task.retailers.join(', ')}` : 'Search across major retailers.'}\n\nFind the best prices and any potential pricing errors.`;

      case 'verify_price':
        return `Verify the price for: ${task.productName}\nExpected price: $${task.expectedPrice}\nURL: ${task.url}\n\nCheck if the current price matches the expected price and report any discrepancies.`;

      case 'discover_products':
        return `Discover products matching: ${task.query}\n\n${task.retailers ? `Search on: ${task.retailers.join(', ')}` : ''}\n\nFind product URLs and basic pricing information.`;

      default:
        return `Task: ${JSON.stringify(task)}`;
    }
  }

  /**
   * Run the agent loop with tool calling
   */
  private async runAgentLoop(
    model: ModelConfig,
    userMessage: string,
    toolsUsed: string[]
  ): Promise<{ success: boolean; data?: ScrapingResult['data']; error?: string }> {
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: SCRAPING_AGENT_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ];

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      const response = await this.callOpenRouter(model, messages);

      if (!response.success) {
        return { success: false, error: response.error };
      }

      const assistantMessage = response.message;

      // Check if the model wants to call tools
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        messages.push(assistantMessage);

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          toolsUsed.push(toolName);

          let args: Record<string, unknown>;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            args = {};
          }

          const toolResult = await executeTool(toolName, args);

          messages.push({
            role: 'tool',
            content: toolResult,
            tool_call_id: toolCall.id,
          });
        }
      } else {
        // Model returned a final response
        const content = assistantMessage.content || '';

        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const data = JSON.parse(jsonMatch[0]);
            if (data.current_price || data.product_name) {
              return {
                success: true,
                data: {
                  product_name: data.product_name,
                  current_price: data.current_price,
                  original_price: data.original_price,
                  currency: data.currency || 'USD',
                  stock_status: data.stock_status,
                  image_url: data.image_url,
                  category: data.category,
                  retailer: data.retailer,
                  url: data.url,
                },
              };
            }
          } catch {
            // JSON parsing failed
          }
        }

        return {
          success: false,
          error: 'Could not extract product data from response',
        };
      }
    }

    return { success: false, error: 'Max iterations reached' };
  }

  /**
   * Call OpenRouter API with tool support
   */
  private async callOpenRouter(
    model: ModelConfig,
    messages: OpenRouterMessage[]
  ): Promise<{ success: boolean; message: OpenRouterMessage; error?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), model.timeoutMs);

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'pricehawk-scraping-agent',
        },
        body: JSON.stringify({
          model: model.id,
          messages,
          tools: SCRAPING_TOOLS,
          tool_choice: 'auto',
          temperature: 0.1,
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          message: { role: 'assistant', content: null },
          error: `API error ${response.status}: ${error}`,
        };
      }

      const data = await response.json();

      if (data.error) {
        return {
          success: false,
          message: { role: 'assistant', content: null },
          error: data.error.message,
        };
      }

      const choice = data.choices?.[0];
      if (!choice) {
        return {
          success: false,
          message: { role: 'assistant', content: null },
          error: 'No response from model',
        };
      }

      return {
        success: true,
        message: choice.message as OpenRouterMessage,
      };
    } catch (error) {
      return {
        success: false,
        message: { role: 'assistant', content: null },
        error: error instanceof Error ? error.message : 'API call failed',
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let agentInstance: ScrapingAgent | null = null;

/**
 * Get the singleton scraping agent instance
 */
export function getScrapingAgent(): ScrapingAgent {
  if (!agentInstance) {
    agentInstance = new ScrapingAgent();
  }
  return agentInstance;
}

/**
 * Convenience function to scrape a URL using the AI agent
 */
export async function aiScrapeUrl(url: string): Promise<ScrapingResult> {
  const agent = getScrapingAgent();
  return agent.execute({ type: 'scrape_url', url });
}

/**
 * Convenience function to search for deals using the AI agent
 */
export async function aiSearchDeals(
  query: string,
  retailers?: string[]
): Promise<ScrapingResult> {
  const agent = getScrapingAgent();
  return agent.execute({ type: 'search_deals', query, retailers });
}

/**
 * Convenience function to discover products using the AI agent
 */
export async function aiDiscoverProducts(
  query: string,
  retailers?: string[]
): Promise<ScrapingResult> {
  const agent = getScrapingAgent();
  return agent.execute({ type: 'discover_products', query, retailers });
}
