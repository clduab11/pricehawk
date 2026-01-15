/**
 * Jina.ai Reader & Search Integration
 * 
 * Provides an "MCP-style" interface to Jina's Reader (`r.jina.ai`) and Search (`s.jina.ai`) APIs.
 * Optimizes web content for LLM consumption.
 */

// Configuration is read from process.env inside methods

export interface JinaReaderOptions {
  /** Output format (default: 'markdown') */
  format?: 'markdown' | 'html' | 'text' | 'screenshot' | 'pageshot';
  /** Generate alt text for images using generic VLM */
  withGeneratedAlt?: boolean;
  /** Include a summary of all links on the page */
  withLinksSummary?: boolean;
  /** Gather all images at the end of the response */
  withImagesSummary?: boolean;
  /** Keep iframe content */
  withIframe?: boolean;
  /** Create a shadow DOM for content extraction */
  withShadowDom?: boolean;
  /** Target specific elements using CSS selectors */
  targetSelector?: string;
  /** Wait for specific elements to load */
  waitForSelector?: string;
  /** Custom request headers (e.g. User-Agent) */
  headers?: Record<string, string>;
  /** Timeout in seconds */
  timeout?: number;
}

export interface JinaSearchOptions {
  /** Return format (default: 'markdown') */
  format?: 'markdown' | 'html' | 'text' | 'json';
  /** Include images in results */
  withImages?: boolean;
}

export interface JinaReaderResponse {
  code: number;
  status: number;
  data: {
    title: string;
    description: string;
    url: string;
    content: string; // The main markdown/html/text content
    usage: {
      tokens: number;
    };
  };
}

export class JinaReader {
  /**
   * Read a URL using Jina Reader
   * Transforms web content into LLM-friendly format.
   */
  async read(url: string, options: JinaReaderOptions = {}): Promise<JinaReaderResponse | null> {
    if (!process.env.JINA_API_KEY) {
      console.warn('Jina API key not configured');
    }

    const {
      format = 'markdown',
      withGeneratedAlt,
      withLinksSummary,
      withImagesSummary,
      withIframe,
      withShadowDom,
      header: customHeaders,
      timeout,
      targetSelector,
      waitForSelector
    } = options as any; // Cast option to any to handle internal mapping if needed

    // Jina supports JSON response via header 'Accept: application/json'
    // or 'X-Return-Format' for the content *inside* the JSON.
    // The main endpoint returns raw text unless we ask for structured JSON.
    // To get metadata (title, etc) reliably, we should request JSON response.

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-Return-Format': format,
    };

    if (process.env.JINA_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;
    }
    
    if (withGeneratedAlt) headers['X-With-Generated-Alt'] = 'true';
    if (withLinksSummary) headers['X-With-Links-Summary'] = 'true';
    if (withImagesSummary) headers['X-With-Images-Summary'] = 'true';
    if (withIframe) headers['X-With-Iframe'] = 'true';
    if (withShadowDom) headers['X-With-Shadow-Dom'] = 'true';
    if (targetSelector) headers['X-Target-Selector'] = targetSelector;
    if (waitForSelector) headers['X-Wait-For-Selector'] = waitForSelector;
    if (timeout) headers['X-Timeout'] = timeout.toString();

    // Merge custom headers if any (e.g. for upstream requests)
    // Note: Jina allows passing standard headers like User-Agent to the target site
    if (customHeaders) {
      Object.assign(headers, customHeaders);
    }

    try {
      const response = await fetch(`https://r.jina.ai/${url}`, {
        method: 'POST', // POST allows body if needed, but simple read uses GET or POST
        headers,
         // Body can be used for advanced options like 'img' injection, but headers suffice for most.
      });

      if (!response.ok) {
        console.error(`Jina Reader failed: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      return data as JinaReaderResponse;

    } catch (error) {
      console.error('Jina Reader error:', error);
      return null;
    }
  }

  /**
   * Search for content using Jina Search
   * Acts as a Grounding layer.
   */
  async search(query: string, options: JinaSearchOptions = {}): Promise<string | null> {
    if (!process.env.JINA_API_KEY) {
      console.warn('Jina API key not configured');
    }
    
    // Search endpoint does not strictly follow the same JSON structure as Reader in all docs,
    // but increasingly unifies it. By default s.jina.ai returns text stream.
    // 'Accept: application/json' should structure it.

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (process.env.JINA_API_KEY) {
       headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;
    }

    try {
      // URL encode query
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(`https://s.jina.ai/${encodedQuery}`, {
        headers,
      });

      if (!response.ok) {
        console.error(`Jina Search failed: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      // Returns raw text often or newline delimited JSON?
      // Actually s.jina.ai often returns markdown directly in body if Accept is not JSON.
      // If JSON, it follows standard structure.
      
      // Let's stick to returning the raw 'data' object or content for now.
      // The type definition depends on strict Jina search response which varies by API version.
      // For safety, we return the whole data object or text.
      
      return JSON.stringify(data);
    } catch (error) {
      console.error('Jina Search error:', error);
      return null;
    }
  }
}

export const jinaReader = new JinaReader();
