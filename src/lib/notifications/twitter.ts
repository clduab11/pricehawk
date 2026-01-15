import { TwitterApi, TwitterApiReadWrite } from 'twitter-api-v2';

export interface TweetPayload {
  text: string;
  mediaBuffer?: Buffer;
  replyToId?: string;
}

export class TwitterClient {
  private client: TwitterApi | null = null;
  private rwClient: TwitterApiReadWrite | null = null;

  constructor() {
    const appKey = process.env.TWITTER_API_KEY;
    const appSecret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessSecret = process.env.TWITTER_ACCESS_SECRET;

    if (appKey && appSecret && accessToken && accessSecret) {
      this.client = new TwitterApi({
        appKey,
        appSecret,
        accessToken,
        accessSecret,
      });
      this.rwClient = this.client.readWrite; // ensure we have read-write access
    } else {
        console.warn("Twitter API keys are missing or incomplete. Twitter functionality will be disabled. Check .env");
    }
  }

  async postTweet(payload: TweetPayload): Promise<string | null> {
    if (!this.rwClient) {
        console.warn("Twitter client not initialized or read-write access missing.");
        return null; 
    }

    try {
      let mediaId: string | undefined;

      if (payload.mediaBuffer) {
        // Upload media (v1 API is standard for media upload even with v2 posting)
        mediaId = await this.rwClient.v1.uploadMedia(payload.mediaBuffer, { mimeType: 'image/png' });
      }

      const tweet = await this.rwClient.v2.tweet({
        text: payload.text,
        media: mediaId ? { media_ids: [mediaId] } : undefined,
        reply: payload.replyToId ? { in_reply_to_tweet_id: payload.replyToId } : undefined,
      });

      return tweet.data.id;
    } catch (error) {
      console.error('Twitter API Error:', error);
      // Don't throw if you want to be resilient, but for now throwing is better for visibility in logs
      return null;
    }
  }
}
