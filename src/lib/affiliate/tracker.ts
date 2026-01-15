import { setKey, getKey, incrementKey } from '@/lib/clients/redis';
import { db } from '@/db';

export class AffiliateTracker {
  private readonly BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  private readonly PREFIX = 'affiliate:track:';

  /**
   * Generates a unique tracking URL for a specific user and glitch.
   * Stores the mapping in Redis for fast redirection.
   */
  async generateTrackingLink(glitchId: string, userId?: string, originalUrl?: string): Promise<string> {
    if (!originalUrl) {
       // Fetch URL from DB if not provided
       const glitch = await db.validatedGlitch.findUnique({
           where: { id: glitchId },
           include: { product: true }
       });
       if (!glitch) throw new Error('Glitch not found');
       originalUrl = glitch.product.url;
    }

    // Wrap with affiliate network format if needed (placeholder)
    const affiliateDestUrl = this.wrapAffiliateUrl(originalUrl);
    
    // Create short ID
    // Format: base64 of glitchId + random suffix, or just UUID. 
    // For readability, we use a simple random string for now.
    const trackingId = Math.random().toString(36).substring(2, 10);

    // Store in Redis (TTL 30 days)
    const data = JSON.stringify({
        url: affiliateDestUrl,
        glitchId,
        userId: userId || 'anonymous',
        createdAt: new Date().toISOString()
    });

    await setKey(`${this.PREFIX}${trackingId}`, data, 30 * 24 * 60 * 60);

    return `${this.BASE_URL}/api/go/${trackingId}`;
  }

  /**
   * Resolve tracking ID to destination URL and log the click.
   */
  async resolveLink(trackingId: string): Promise<string | null> {
      const key = `${this.PREFIX}${trackingId}`;
      const dataStr = await getKey(key);

      if (!dataStr) return null;

      try {
          const data = JSON.parse(dataStr);
          
          // Async logging (don't block redirect)
          this.logClick(trackingId, data.glitchId, data.userId);

          return data.url;
      } catch (e) {
          console.error('Error parsing affiliate data', e);
          return null;
      }
  }

  private wrapAffiliateUrl(url: string): string {
      // Placeholder logic for appending affiliate tags
      // e.g. Amazon tag, Skimlinks, etc.
      // For now pass through
      return url;
  }

  private async logClick(trackingId: string, glitchId: string, userId: string) {
      await incrementKey(`affiliate:clicks:${trackingId}`);
      await incrementKey(`affiliate:clicks:glitch:${glitchId}`);
      
      // Persist to AuditLog for analytics
      try {
        await db.auditLog.create({
            data: {
                action: 'affiliate.click',
                entity: 'glitch',
                entityId: glitchId,
                userId: userId !== 'anonymous' ? userId : undefined,
                metadata: { trackingId }
            }
        });
      } catch (e) {
          console.error('Failed to log affiliate click to DB', e);
      }
  }
}
