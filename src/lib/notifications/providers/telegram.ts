import { NotificationProvider, NotificationResult, ValidatedGlitch } from '@/types';

/**
 * Telegram Provider
 * Sends messages via Telegram Bot API
 */
export class TelegramProvider implements NotificationProvider {
  private botToken: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  }

  async send(glitch: ValidatedGlitch, chatId?: string): Promise<NotificationResult> {
    if (!this.botToken) {
      return {
        success: false,
        channel: 'telegram',
        error: 'Telegram Token not configured',
        sentAt: new Date().toISOString(),
      };
    }

    if (!chatId) {
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
          chat_id: chatId,
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

  private formatMessage(glitch: ValidatedGlitch): string {
    const { product, profitMargin } = glitch;
    
    return `
🚨 <b>${Math.round(profitMargin)}% OFF!</b>

<b>${product.title}</b>

💰 <b>Now: $${product.price.toFixed(2)}</b>
<s>Was: $${(product.originalPrice ?? 0).toFixed(2)}</s>

<a href="${product.url}">👉 Vew Deal</a>
`.trim();
  }
}
