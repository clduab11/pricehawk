import { NotificationProvider, NotificationResult, ValidatedGlitch } from '@/types';

/**
 * Telegram Provider
 * Sends messages via Telegram Bot API
 */
export class TelegramProvider implements NotificationProvider {
  private botToken: string;
  private channelId: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.channelId = process.env.TELEGRAM_CHANNEL_ID || '';
  }

  async send(glitch: ValidatedGlitch, chatId?: string): Promise<NotificationResult> {
    const targetId = chatId || this.channelId;
    
    if (!this.botToken) {
      return {
        success: false,
        channel: 'telegram',
        error: 'Telegram Token not configured',
        sentAt: new Date().toISOString(),
      };
    }

    if (!targetId) {
      return {
        success: false,
        channel: 'telegram',
        error: 'No Telegram Chat ID provided',
        sentAt: new Date().toISOString(),
      };
    }

    try {
      const message = this.formatMessage(glitch);
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Telegram API error: ${error.description || 'Unknown'}`);
      }

      const data = await response.json();

      return {
        success: true,
        channel: 'telegram',
        messageId: data.result?.message_id?.toString(),
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
       return {
        success: false,
        channel: 'telegram',
        error: error instanceof Error ? error.message : 'Unknown error',
        sentAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Broadcast a photo message to the configured channel
   */
  async broadcastPhoto(caption: string, imageBuffer: Buffer): Promise<NotificationResult> {
      if (!this.botToken || !this.channelId) {
          return { success: false, channel: 'telegram', error: 'Missing config', sentAt: new Date().toISOString() };
      }

      try {
          // Construct FormData for file upload
          const formData = new FormData();
          formData.append('chat_id', this.channelId);
          formData.append('caption', caption);
          formData.append('parse_mode', 'HTML');
          
          // Blob from buffer
          const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });
          formData.append('photo', blob, 'deal.png');

          const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, {
              method: 'POST',
              body: formData,
          });

          if (!response.ok) {
              const error = await response.json();
              throw new Error(`Telegram API error: ${error.description}`);
          }

          const data = await response.json();
          return {
              success: true,
              channel: 'telegram',
              messageId: data.result?.message_id?.toString(),
              sentAt: new Date().toISOString()
          };

      } catch (error: any) {
          console.error('Telegram Photo Error:', error);
          return {
              success: false,
              channel: 'telegram',
              error: error.message,
              sentAt: new Date().toISOString()
          };
      }
  }

  private formatMessage(glitch: ValidatedGlitch): string {
    const { product, profitMargin } = glitch;
    
    return `
🚨 <b>${Math.round(profitMargin)}% OFF!</b>

<b>${product.title}</b>

💰 <b>Now: $${product.price.toFixed(2)}</b>
<s>Was: $${(product.originalPrice ?? 0).toFixed(2)}</s>

<a href="${product.url}">👉 View Deal</a>
`.trim();
  }
}
