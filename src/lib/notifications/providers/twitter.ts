import { NotificationProvider, NotificationResult, ValidatedGlitch } from '@/types';
import { TwitterApi } from 'twitter-api-v2';

/**
 * Twitter Provider
 * 
 * Supports:
 * 1. Broadcast (Official Account via API Keys)
 * 2. Influencer Mode (User Account via OAuth)
 */
export class TwitterProvider implements NotificationProvider {
  private client: TwitterApi | null = null;

  constructor() {
    if (process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET && process.env.TWITTER_ACCESS_TOKEN && process.env.TWITTER_ACCESS_SECRET) {
      this.client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
      });
    }
  }

  /**
   * Send notification (Broadcast mode)
   */
  async send(glitch: ValidatedGlitch, target?: string): Promise<NotificationResult> {
    if (!this.client) {
      console.log(`[Twitter] No API keys configured, skipping broadcast for ${glitch.id}`);
       return {
            success: false,
            channel: 'twitter',
            error: 'No API keys configured',
            sentAt: new Date().toISOString()
        };
    }

    try {
        // Just text for now, use postWithMedia for rich content
        const tweetText = this.formatTweet(glitch);
        const response = await this.client.v2.tweet(tweetText);
        
        return {
            success: true,
            channel: 'twitter',
            sentAt: new Date().toISOString(),
            messageId: response.data.id
        };
    } catch (error: any) {
        console.error('Twitter Broadcast Error:', error);
        return {
            success: false,
            channel: 'twitter',
            error: error.message || 'Failed to broadcast tweet',
            sentAt: new Date().toISOString()
        };
    }
  }

  /**
   * Post with media (Image/Chart)
   */
  async postWithMedia(text: string, mediaBuffer: Buffer, userTokens?: { accessToken: string, accessSecret: string }): Promise<NotificationResult> {
      try {
          const client = userTokens 
            ? new TwitterApi({
                appKey: process.env.TWITTER_API_KEY!,
                appSecret: process.env.TWITTER_API_SECRET!,
                accessToken: userTokens.accessToken,
                accessSecret: userTokens.accessSecret,
            })
            : this.client;

          if (!client) throw new Error("No Twitter client available");

          // 1. Upload media (v1.1 API)
          const mediaId = await client.v1.uploadMedia(mediaBuffer, { type: 'png' });

          // 2. Tweet with media (v2 API)
          const response = await client.v2.tweet({
              text: text,
              media: { media_ids: [mediaId] }
          });

          return {
              success: true,
              channel: 'twitter',
              sentAt: new Date().toISOString(),
              messageId: response.data.id
          };

      } catch (error: any) {
          console.error('Twitter Media Post Error:', error);
          return {
              success: false,
              channel: 'twitter',
              error: error.message || 'Failed to post tweet with media',
              sentAt: new Date().toISOString()
          };
      }
  }

  /**
   * Post to a specific user's timeline (Influencer Mode)
   * Uses stored OAuth tokens.
   */
  async postAsUser(glitch: ValidatedGlitch, userTokens: { accessToken: string, accessSecret: string }): Promise<NotificationResult> {
    try {
        const client = new TwitterApi({
            appKey: process.env.TWITTER_API_KEY!,
            appSecret: process.env.TWITTER_API_SECRET!,
            accessToken: userTokens.accessToken,
            accessSecret: userTokens.accessSecret,
        });
        
        const tweetText = this.formatTweet(glitch);
        const response = await client.v2.tweet(tweetText);

        return {
            success: true,
            channel: 'twitter',
            sentAt: new Date().toISOString(),
            messageId: response.data.id
        };

    } catch (error: any) {
        console.error('Twitter Post Error:', error);
        return {
            success: false,
            channel: 'twitter',
            error: error.message || 'Failed to post tweet',
            sentAt: new Date().toISOString()
        };
    }
  }

  private formatTweet(glitch: ValidatedGlitch): string {
    const { product, profitMargin } = glitch;
    const emoji = profitMargin > 90 ? '🚨' : '🔥';
    
    return `${emoji} FLASH DEAL ALERT!\n\n${product.title.substring(0, 100)}\n\n📉 -${Math.round(profitMargin)}% OFF\n💰 $${product.price.toFixed(2)}\n\n👉 ${product.url}\n\n#Deals #PriceGlitch`;
  }
}
