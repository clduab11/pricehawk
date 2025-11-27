import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL!;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN!;

if (!redisUrl || !redisToken) {
  console.warn('Upstash Redis environment variables not configured');
}

export const redis = new Redis({
  url: redisUrl || 'https://placeholder.upstash.io',
  token: redisToken || 'placeholder-token',
});

// Redis stream keys
export const REDIS_KEYS = {
  ANOMALY_DETECTED: 'price:anomaly:detected',
  ANOMALY_CONFIRMED: 'price:anomaly:confirmed',
  NOTIFICATION_PENDING: 'notification:pending',
  DEDUP_SET: 'dedup:products',
} as const;

// Publish anomaly to Redis stream
export async function publishAnomaly(anomalyId: string, data: Record<string, unknown>): Promise<void> {
  await redis.xadd(REDIS_KEYS.ANOMALY_DETECTED, '*', {
    id: anomalyId,
    data: JSON.stringify(data),
    timestamp: new Date().toISOString(),
  });
}

// Publish confirmed glitch to Redis stream
export async function publishConfirmedGlitch(glitchId: string, data: Record<string, unknown>): Promise<void> {
  await redis.xadd(REDIS_KEYS.ANOMALY_CONFIRMED, '*', {
    id: glitchId,
    data: JSON.stringify(data),
    timestamp: new Date().toISOString(),
  });
}

// Check if product URL was recently processed (deduplication)
export async function isRecentlyProcessed(productUrl: string, ttlSeconds = 300): Promise<boolean> {
  const key = `${REDIS_KEYS.DEDUP_SET}:${Buffer.from(productUrl).toString('base64')}`;
  const exists = await redis.exists(key);
  
  if (!exists) {
    await redis.set(key, '1', { ex: ttlSeconds });
    return false;
  }
  
  return true;
}
