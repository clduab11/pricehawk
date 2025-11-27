import { NotificationProvider, NotificationResult, ValidatedGlitch } from '@/types';

/**
 * Discord Webhook Provider
 * Sends rich embed notifications to Discord channels
 */
export class DiscordProvider implements NotificationProvider {
  private webhookUrl: string;

  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';
  }

  async send(glitch: ValidatedGlitch): Promise<NotificationResult> {
    if (!this.webhookUrl) {
      return {
        success: false,
        channel: 'discord',
        error: 'Discord webhook URL not configured',
        sentAt: new Date().toISOString(),
      };
    }

    try {
      const embed = this.createEmbed(glitch);

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '🚨 **NEW PRICING ERROR DETECTED!** 🚨',
          embeds: [embed],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Discord webhook error: ${error}`);
      }

      return {
        success: true,
        channel: 'discord',
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        channel: 'discord',
        error: error instanceof Error ? error.message : 'Unknown error',
        sentAt: new Date().toISOString(),
      };
    }
  }

  private createEmbed(glitch: ValidatedGlitch): Record<string, unknown> {
    const { product, validation, profit_margin } = glitch;
    const savings = (product.original_price ?? 0) - product.current_price;

    return {
      title: `🔥 ${product.product_name}`,
      description: `**${Math.round(profit_margin)}% OFF** - Confidence: ${validation.confidence}%`,
      url: product.url,
      color: this.getColorByDiscount(profit_margin),
      fields: [
        {
          name: 'Original Price',
          value: `$${(product.original_price ?? 0).toFixed(2)}`,
          inline: true,
        },
        {
          name: 'Current Price',
          value: `$${product.current_price.toFixed(2)}`,
          inline: true,
        },
        {
          name: 'Savings',
          value: `$${savings.toFixed(2)}`,
          inline: true,
        },
        {
          name: 'Retailer',
          value: product.retailer_id.toUpperCase(),
          inline: true,
        },
        {
          name: 'Stock',
          value: product.stock_status === 'in_stock' ? '✅ In Stock' : '⚠️ Limited',
          inline: true,
        },
        {
          name: 'Glitch Type',
          value: validation.glitch_type.replace('_', ' ').toUpperCase(),
          inline: true,
        },
      ],
      thumbnail: product.image_url ? { url: product.image_url } : undefined,
      footer: {
        text: '⏰ Act fast - prices may change!',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private getColorByDiscount(profitMargin: number): number {
    if (profitMargin >= 70) return 0xff0000; // Red - Hot deal
    if (profitMargin >= 50) return 0xff6600; // Orange - Great deal
    if (profitMargin >= 30) return 0xffaa00; // Yellow - Good deal
    return 0x00ff00; // Green - Decent deal
  }
}
