
export class AlertService {
  private webhookUrl: string;

  constructor() {
    this.webhookUrl = process.env.DISCORD_ALERTS_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || '';
  }

  async sendAlert(title: string, error: any, context: Record<string, any> = {}): Promise<void> {
    if (!this.webhookUrl) {
      console.warn('[AlertService] No webhook URL configured, skipping alert:', title);
      return;
    }

    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      
      const contextString = Object.entries(context)
        .map(([k, v]) => `**${k}**: \`${v}\``)
        .join('\n');

      const payload = {
        content: `🚨 **SYSTEM ALERT: ${title}**`,
        embeds: [{
          title: 'Error Details',
          description: `\`\`\`${errorMessage}\`\`\``,
          color: 0xff0000, // Red
          fields: [
            {
              name: 'Context',
              value: contextString || 'None',
            },
            ...(stack ? [{
              name: 'Stack Trace',
              value: `\`\`\`${stack.substring(0, 1000)}\`\`\``, // Limit length
            }] : [])
          ],
          timestamp: new Date().toISOString(),
        }]
      };

      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

    } catch (err) {
      console.error('[AlertService] Failed to send alert', err);
    }
  }
}

export const alertService = new AlertService();
