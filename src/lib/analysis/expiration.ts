import { ValidatedGlitch } from '@/types';
import { scrapeUrl } from '@/lib/scraping/firecrawl';

export class ExpirationChecker {
  /**
   * Checks if the deal is still valid by re-scraping the product page.
   * Returns true if expired, false if still active.
   */
  async checkExpiration(glitch: ValidatedGlitch): Promise<boolean> {
    console.log(`[Expiration] Checking validity for ${glitch.product.url}`);

    try {
      // Use Firecrawl/Jina with extract schema to get current price
      const result = await scrapeUrl({
        url: glitch.product.url,
        formats: ['json'],
        extract: {
           schema: {
             type: 'object',
             properties: {
               current_price: { type: 'number' },
               stock_status: { type: 'string' }
             },
             required: ['current_price']
           }
        }
      });

      if (!result.success || !result.data?.llm_extraction?.current_price) {
          console.warn(`[Expiration] Failed to re-scrape ${glitch.id}, assuming valid (safe failure) or invalid?`);
          // If we can't verify, we might checking lastVerified timestamp.
          // For now, if we can't scrape, we assume it's risky to post.
          // But maybe we should be conservative.
          // Let's assume valid but log warning, to avoid killing all posts on scraper fail.
          // Actually, if scraper blocked, we don't want to post fake news.
          // User requirement: "Re-scrape validated glitches... Mark as expired if price returns..."
          // If we fail to get price, we can't determine.
          return false; // Assume VALID (not expired) if fetch fails? Or true (expired)? logic choice.
          // Let's assume it IS expired if we can't verify, to be safe? No, that kills momentum.
          // Let's return false (not expired) but maybe flag it.
      }

      const currentPrice = result.data.llm_extraction.current_price;
      const stockStatus = result.data.llm_extraction.stock_status;

      // Check if price increased significantly
      // Threshold: 10% more than glitch price
      if (currentPrice > glitch.product.price * 1.1) {
          console.log(`[Expiration] Price increased: ${currentPrice} > ${glitch.product.price}. Expired.`);
          return true;
      }

      // Check OOS
      if (stockStatus && (stockStatus.includes('out') || stockStatus.includes('sold'))) {
          console.log(`[Expiration] Item is OOS. Expired.`);
          return true;
      }

      console.log(`[Expiration] Deal still active. Current: ${currentPrice}, Glitch: ${glitch.product.price}`);
      return false;

    } catch (error) {
       console.error(`[Expiration] verification error`, error);
       return false; // Fail open (allow posting) or closed?
       // Let's fail open (false) for now.
    }
  }
}
