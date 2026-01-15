import { NotificationProvider, NotificationResult, ValidatedGlitch } from '@/types';

/**
 * WhatsApp Provider
 * Sends messages via Meta Cloud API
 */
export class WhatsAppProvider implements NotificationProvider {
  private apiToken: string;
  private phoneNumberId: string;

  constructor() {
    this.apiToken = process.env.WHATSAPP_API_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  }

  async send(glitch: ValidatedGlitch, to?: string): Promise<NotificationResult> {
    if (!this.apiToken || !this.phoneNumberId) {
      return {
        success: false,
        channel: 'whatsapp',
        error: 'WhatsApp credentials not configured',
        sentAt: new Date().toISOString(),
      };
    }

    if (!to) {
      return {
        success: false,
        channel: 'whatsapp',
        error: 'No phone number provided',
        sentAt: new Date().toISOString(),
      };
    }

    try {
      // Basic text message for now. Templates required for outbound business initiated convo, 
      // but assuming 24h window or approved template usage later. 
      // For strictly outbound to users who haven't messaged first, we MUST use templates.
      // Implementing fallback: Template if 'glitch_alert' exists, else text (might fail if outside window).
      
      // NOTE: Using a simple text message for dev/sandbox. 
      // In production, you typically need a pre-approved template named "glitch_alert" or similar.
      // We will try standard text message first.
      
      const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: {
            preview_url: true, // Enables link preview
            body: this.formatMessage(glitch)
          }
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
      }

      const data = await response.json();

      return {
        success: true,
        channel: 'whatsapp',
        messageId: data.messages?.[0]?.id,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
       return {
        success: false,
        channel: 'whatsapp',
        error: error instanceof Error ? error.message : 'Unknown error',
        sentAt: new Date().toISOString(),
      };
    }
  }

  private formatMessage(glitch: ValidatedGlitch): string {
    const { product, profitMargin } = glitch;
    
    return `🚨 *${Math.round(profitMargin)}% OFF!*

*${product.title}*

💰 Now: $${product.price.toFixed(2)}
~Was: $${(product.originalPrice ?? 0).toFixed(2)}~

${product.url}`;
  }
}
