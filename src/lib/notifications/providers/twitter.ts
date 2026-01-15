import { NotificationProvider, NotificationResult, ValidatedGlitch } from '@/types';
import { TwitterApi } from 'twitter-api-v2';

/**
 * Twitter Provider
 * 
 * Supports:
 * 1. Broadcast (Official Account - NOT IMPLEMENTED YET)
 * 2. Influencer Mode (User Account via OAuth)
 */
export class TwitterProvider implements NotificationProvider {
  /**
   * Send notification (Broadcast mode)
   */
  async send(glitch: ValidatedGlitch, target?: string): Promise<NotificationResult> {
    
    // START PLACEHOLDER
    // For now we just log, as broadcast requires a central bot account config
    console.log(`[Twitter] Would broadcast glitch ${glitch.id} to ${target || 'timeline'}`);
    
    return {
      success: true,
      channel: 'twitter',
      sentAt: new Date().toISOString(),
      messageId: 'mock-tweet-broadcast'
    };
    // END PLACEHOLDER
  }

  /**
   * Post to a specific user's timeline (Influencer Mode)
   * Uses stored OAuth tokens.
   */
  async postAsUser(glitch: ValidatedGlitch, userTokens: { accessToken: string, refreshToken?: string }): Promise<NotificationResult> {
    try {
        const client = new TwitterApi(userTokens.accessToken);
        
        // If we had refreshToken and client keys, we could auto-refresh here if needed.
        // For MVP, we assume accessToken is valid or we accept the error.

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
