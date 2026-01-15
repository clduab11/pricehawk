import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractProductsFromMarkdown } from './extractor';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AI Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  const sampleMarkdown = `
    # Awesome Product
    Price: $29.99 (was $40.00)
    [View Item](https://example.com/item)
    Status: In Stock
    
    ## Another Deal
    Clearance: $9.99
    ![Image](img.jpg)
  `;

  it('should return empty array if API key is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const result = await extractProductsFromMarkdown('md', 'url');
    expect(result).toEqual([]);
  });

  it('should extract products from valid AI response', async () => {
    const mockReponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            products: [
              {
                title: 'Awesome Product',
                price: 29.99,
                originalPrice: 40.00,
                url: 'https://example.com/item',
                stockStatus: 'in_stock'
              },
              {
                title: 'Another Deal',
                price: 9.99,
                url: 'url2',
                stockStatus: 'out_of_stock'
              }
            ]
          })
        }
      }]
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReponse)
    });

    const result = await extractProductsFromMarkdown(sampleMarkdown, 'https://example.com');
    
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Awesome Product');
    expect(result[0].price).toBe(29.99);
    expect(result[0].retailer).toBe('example.com');
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('Error')
    });

    const result = await extractProductsFromMarkdown('md', 'url');
    expect(result).toEqual([]);
  });

  it('should handle malformed JSON from AI', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
            choices: [{
                message: {
                    content: 'Not JSON'
                }
            }]
        })
      });
  
      const result = await extractProductsFromMarkdown('md', 'url');
      expect(result).toEqual([]);
    });
});
