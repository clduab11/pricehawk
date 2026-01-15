import { getKey, setKey } from '../clients/redis';

export class ImageCache {
  private static readonly TTL = 3600; // 1 hour

  static async get(key: string): Promise<Buffer | null> {
    const cached = await getKey(`chart:${key}`);
    if (!cached) return null;
    return Buffer.from(cached, 'base64');
  }

  static async set(key: string, image: Buffer): Promise<void> {
    await setKey(`chart:${key}`, image.toString('base64'), this.TTL);
  }
}
