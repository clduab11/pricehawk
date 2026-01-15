import { ProductData } from '@/scrapers/types';

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'deepseek/deepseek-chat'; // DeepSeek V3 - Cost effective and good at extracting structure

const SYSTEM_PROMPT = `You are an expert data extraction AI. Your job is to extract e-commerce product information from raw markdown content.

Input: Markdown text from a scraped webpage.
Output: A JSON object containing an array of products.

Product Schema:
{
  "title": string,
  "price": number, (extract numeric value only, handle currency symbols)
  "originalPrice": number | null, (if available)
  "description": string | null,
  "url": string, (absolute URL preferred, if relative use as provided)
  "imageUrl": string | null,
  "stockStatus": "in_stock" | "out_of_stock" | "pre_order" | "unknown",
  "retailerSku": string | null
}

Instructions:
1. Identify all distinct products in the markdown.
2. If the page is a single product page, return an array with one item.
3. If the page is a search result or category page, return all relevant products.
4. Clean up titles and descriptions (remove extra whitespace).
5. Ensure prices are numbers (e.g., "$19.99" -> 19.99).
6. Infer stock status from keywords like "Sold Out", "Add to Cart", etc.
7. Return ONLY valid JSON in the format: { "products": [...results] }`;

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
  };
}

export async function extractProductsFromMarkdown(markdown: string, sourceUrl: string): Promise<ProductData[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('OpenRouter API key not configured, returning empty extraction');
    return [];
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'pricehawk',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Source URL: ${sourceUrl}\n\nMarkown Content:\n${markdown.slice(0, 15000)}` }, // Truncate to avoid context limits if huge
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Extractor API Error: ${response.status} - ${errorText}`);
        return [];
    }

    const data: OpenRouterResponse = await response.json();
    
    if (data.error) {
      console.error('Extractor OpenRouter Error:', data.error.message);
      return [];
    }

    const content = data.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    
    if (!parsed.products || !Array.isArray(parsed.products)) {
        console.warn('Extractor returned invalid structure:', content.slice(0, 100));
        return [];
    }

    // Post-process and validate structure
    const products: ProductData[] = parsed.products.map((p: any) => ({
      title: p.title || 'Unknown Product',
      price: typeof p.price === 'number' ? p.price : 0,
      originalPrice: typeof p.originalPrice === 'number' ? p.originalPrice : undefined,
      description: p.description || undefined,
      url: resolveUrl(p.url, sourceUrl),
      imageUrl: p.imageUrl || undefined,
      stockStatus: p.stockStatus || 'unknown',
      retailerSku: p.retailerSku || undefined,
      retailer: new URL(sourceUrl).hostname.replace('www.', ''), // Infer retailer from source
      scrapedAt: new Date().toISOString()
    }));

    return products;

  } catch (error) {
    console.error('Extraction exception:', error);
    return [];
  }
}

function resolveUrl(href: string | undefined, base: string): string {
    if (!href) return base;
    try {
        return new URL(href, base).href;
    } catch {
        return href;
    }
}
