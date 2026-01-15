import { jinaReader } from '../lib/scraping/jina-reader';
import { extractProductsFromMarkdown } from '../lib/ai/extractor';
import { ProductData, ScrapingJob, ScraperConfig } from './types';

export class JinaWorker {
  constructor(private config: ScraperConfig) {}

  async initialize(): Promise<void> {
    // No initialization needed for Jina API
  }

  async scrapeProducts(job: ScrapingJob): Promise<ProductData[]> {
    // Use Jina Reader to get markdown content
    const result = await jinaReader.read(job.url, {
      format: 'markdown',
      withLinksSummary: false
    });

    if (!result || !result.data) {
        console.error('Jina Reader failed or returned no data');
        return [];
    }

    // Extract structured product data from the markdown using LLM
    const products = await extractProductsFromMarkdown(result.data.content, job.url);
    
    // Log success
    console.log(`Jina extracted ${products.length} products from ${result.data.title}`);

    return products;
  }

  async cleanup(): Promise<void> {
    // No specific cleanup needed
  }
}
