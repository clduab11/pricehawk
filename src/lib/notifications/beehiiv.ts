import axios from 'axios';

export interface BeehiivPost {
  title: string;
  content: string; // HTML body
  audience: 'free' | 'paid' | 'all';
  scheduled_at?: number; // Unix timestamp
}

export class BeehiivProvider {
  private apiKey: string;
  private pubId: string;
  private baseUrl = 'https://api.beehiiv.com/v2';

  constructor() {
    this.apiKey = process.env.BEEHIIV_API_KEY || '';
    this.pubId = process.env.BEEHIIV_PUBLICATION_ID || '';

    if (!this.apiKey || !this.pubId) {
        console.warn("Beehiiv configurations missing.");
    }
  }

  async createPublication(post: BeehiivPost): Promise<string | null> {
    if (!this.apiKey || !this.pubId) return null;

    try {
      // Structure based on common Beehiiv API usage for v2
      const payload = {
            title: post.title,
            platform: ['email', 'web'],
            content: {
                free: { web: post.content, email: post.content },
                premium: { web: post.content, email: post.content }
            },
            tier: post.audience === 'paid' ? 'premium' : 'free', // simplistic mapping
            scheduled_at: post.scheduled_at
      };

      const response = await axios.post(
        `${this.baseUrl}/publications/${this.pubId}/posts`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data?.data?.id || null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
          console.error("Beehiiv API Error:", error.response?.data || error.message);
      } else {
          console.error("Beehiiv Error:", error);
      }
      return null;
    }
  }
}
