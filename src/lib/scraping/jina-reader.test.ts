import { expect, test, describe, vi, beforeEach } from 'vitest';
import { jinaReader, JinaReaderOptions } from './jina-reader';

// Mock Fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('JinaReader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JINA_API_KEY = 'test-key';
  });

  describe('read', () => {
    test('sends correct headers for basic markdown read', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 200,
          status: 200,
          data: { title: 'Test', content: '# Test content' }
        })
      });

      const url = 'https://example.com';
      await jinaReader.read(url);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://r.jina.ai/${url}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'X-Return-Format': 'markdown',
            'Authorization': 'Bearer test-key'
          })
        })
      );
    });

    test('includes optional headers when flags are set', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await jinaReader.read('https://example.com', {
        withGeneratedAlt: true,
        withLinksSummary: true,
        targetSelector: 'main'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-With-Generated-Alt': 'true',
            'X-With-Links-Summary': 'true',
            'X-Target-Selector': 'main'
          })
        })
      );
    });

    test('handles API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      const result = await jinaReader.read('https://bad.url');
      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    test('encodes query parameter correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] })
      });

      const query = 'price glitch "monitor"';
      await jinaReader.search(query);

      const encoded = encodeURIComponent(query);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://s.jina.ai/${encoded}`,
        expect.anything()
      );
    });
  });
});
