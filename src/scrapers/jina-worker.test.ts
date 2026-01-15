import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JinaWorker } from './jina-worker';
import { jinaReader } from '../lib/scraping/jina-reader';
import { extractProductsFromMarkdown } from '../lib/ai/extractor';

// Mock dependencies
vi.mock('../lib/scraping/jina-reader', () => ({
  jinaReader: {
    read: vi.fn()
  }
}));

vi.mock('../lib/ai/extractor', () => ({
  extractProductsFromMarkdown: vi.fn()
}));

describe('JinaWorker', () => {
  let worker: JinaWorker;

  beforeEach(() => {
    vi.clearAllMocks();
    worker = new JinaWorker({});
  });

  const mockJob = {
    id: 'job-1',
    url: 'https://example.com/products',
    retailer: 'example',
    keywords: [],
    postedAt: new Date()
  };

  it('should scrape and extract products using Jina and AI', async () => {
    const mockMarkdownResult = {
      data: {
        title: 'Page Title',
        content: '# Product List...',
      }
    };
    
    (jinaReader.read as any).mockResolvedValue(mockMarkdownResult);

    const mockProducts = [
      { title: 'P1', price: 10, url: 'u1' }
    ];
    (extractProductsFromMarkdown as any).mockResolvedValue(mockProducts);

    const result = await worker.scrapeProducts(mockJob);

    expect(jinaReader.read).toHaveBeenCalledWith(mockJob.url, expect.objectContaining({ format: 'markdown' }));
    expect(extractProductsFromMarkdown).toHaveBeenCalledWith('# Product List...', mockJob.url);
    expect(result).toEqual(mockProducts);
  });

  it('should return empty array if Jina Reader fails', async () => {
    (jinaReader.read as any).mockResolvedValue(null);

    const result = await worker.scrapeProducts(mockJob);

    expect(result).toEqual([]);
    expect(extractProductsFromMarkdown).not.toHaveBeenCalled();
  });

  it('should return empty array if Jina returns no data', async () => {
      (jinaReader.read as any).mockResolvedValue({ data: null });
  
      const result = await worker.scrapeProducts(mockJob);
  
      expect(result).toEqual([]);
    });
});
