
export class AffiliateService {
  private static amazonTag = process.env.AMAZON_AFFILIATE_TAG || 'pricehawk-20';
  
  /**
   * Transforms a clean product URL into an affiliate URL based on the retailer.
   */
  static transformUrl(url: string, retailer: string): string {
    if (!url) return url;

    try {
      const urlObj = new URL(url);

      switch (retailer.toLowerCase()) {
        case 'amazon':
          return this.amazonize(urlObj);
        case 'bestbuy':
        case 'target':
        case 'walmart':
          // Placeholder for Impact Radius / Skimlinks logic
          // For now, we return the original URL as we don't have real generic logic yet
          // But we could append UTM params if needed
          return this.appendUtm(urlObj);
        default:
          return this.appendUtm(urlObj);
      }
    } catch (e) {
      console.error('Invalid URL provided to AffiliateService:', url);
      return url;
    }
  }

  private static amazonize(url: URL): string {
    // Amazon logic: Append or replace 'tag' query param
    url.searchParams.set('tag', this.amazonTag);
    return url.toString();
  }

  private static appendUtm(url: URL): string {
    // Basic UTM tracking for our own analytics
    if (!url.searchParams.has('utm_source')) {
      url.searchParams.set('utm_source', 'pricehawk');
      url.searchParams.set('utm_medium', 'social');
    }
    return url.toString();
  }
}
