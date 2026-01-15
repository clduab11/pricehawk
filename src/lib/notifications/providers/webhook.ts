import { NotificationProvider, NotificationResult, ValidatedGlitch } from '@/types';

export class WebhookProvider implements NotificationProvider {
  /**
   * Send webhook notification
   * Note: Webhook URL is taken from environment variable or user config
   * For this MVP, we'll assume a global notification webhook or look for it in the user's preferences if passed context
   */
  async send(glitch: ValidatedGlitch, destination?: string): Promise<NotificationResult> {
    const webhookUrl = destination || process.env.DISCORD_WEBHOOK_URL || process.env.GLOBAL_WEBHOOK_URL;

    if (!webhookUrl) {
      return {
        success: false,
        channel: 'webhook',
        error: 'No webhook URL provided',
        sentAt: new Date().toISOString(),
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Pricehawk-Glitch-Bot/1.0',
        },
        body: JSON.stringify(glitch),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          channel: 'webhook',
          error: `Webhook failed with status: ${response.status} ${response.statusText}`,
          sentAt: new Date().toISOString(),
        };
      }

      return {
        success: true,
        channel: 'webhook',
        messageId: `webhook-${Date.now()}`,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        channel: 'webhook',
        error: error instanceof Error ? error.message : 'Unknown webhook error',
        sentAt: new Date().toISOString(),
      };
    }
  }
}
