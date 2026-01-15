import { WhatsAppProvider } from '../notifications/whatsapp';
import { incrementKey, getKey, setKey } from '../clients/redis';

export class WhatsAppScheduler {
    private provider: WhatsAppProvider;
    private MAX_DAILY = 5;

    constructor() {
        this.provider = new WhatsAppProvider();
    }

    /**
     * Send an alert with daily rate limiting per user
     */
    async sendAlert(userId: string, phoneNumber: string, glitchData: { title: string; price: number; url: string }): Promise<boolean> {
        // Check limit
        const today = new Date().toISOString().split('T')[0];
        const key = `whatsapp:limit:${userId}:${today}`;
        
        const currentStr = await getKey(key);
        const current = currentStr ? parseInt(currentStr) : 0;

        if (current >= this.MAX_DAILY) {
            console.log(`User ${userId} reached daily WhatsApp limit (${this.MAX_DAILY}).`);
            return false;
        }

        // Send using a standard template 'price_alert'
        // Template params: {{1}}=Title, {{2}}=Price, {{3}}=URL
        const sent = await this.provider.sendTemplateMessage(phoneNumber, 'price_alert', 'en_US', [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: glitchData.title.substring(0, 60) }, // Truncate title
                    { type: 'text', text: `$${glitchData.price.toFixed(2)}` },
                    { type: 'text', text: glitchData.url } // You probably want a short URL here
                ]
            }
        ]);

        if (sent) {
            await incrementKey(key);
            // Ensure TTL expires after 24 hours (approx)
            if (current === 0) {
                 await setKey(key, '1', 86400); 
            }
        }

        return sent;
    }
}
