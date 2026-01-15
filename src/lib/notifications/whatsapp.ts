import axios from 'axios';

export class WhatsAppProvider {
  private accessToken: string;
  private phoneNumberId: string;
  private businessAccountId: string;

  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

    if (!this.accessToken) {
        // Only warn if we expect to run this
        // console.warn("WhatsApp Access Token missing");
    }
  }

  async sendTemplateMessage(to: string, templateName: string, languageCode = 'en_US', components: any[] = []): Promise<boolean> {
    if (!this.accessToken || !this.phoneNumberId) {
        console.warn("WhatsApp credentials missing, cannot send.");
        return false;
    }

    try {
      await axios.post(
        `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to, // Phone number with country code
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return true;
    } catch (error) {
       if (axios.isAxiosError(error)) {
           console.error("WhatsApp API Error:", JSON.stringify(error.response?.data));
       } else {
           console.error("WhatsApp Error:", error);
       }
       return false;
    }
  }
}
