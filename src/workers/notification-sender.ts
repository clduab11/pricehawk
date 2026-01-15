import { readStream, getKey, setKey, REDIS_KEYS } from '@/lib/clients/redis';
import { notificationManager } from '@/lib/notifications/manager';
import { subscriberNotificationService } from '@/lib/notifications/subscriber-service';
import { moveToDLQ } from '@/lib/streams/dlq';
import { metrics } from '@/lib/monitoring/metrics';
import { addNotificationJob, NotificationJobData } from '@/lib/queues/notification-queue';
import type { ValidatedGlitch } from '@/types';
import { Worker } from 'bullmq';

const CURSOR_KEY = 'cursor:stream:anomaly_confirmed';
const BATCH_SIZE = Number.parseInt(process.env.STREAM_BATCH_SIZE || '50', 10);
const POLL_INTERVAL_MS = Number.parseInt(process.env.STREAM_POLL_INTERVAL_MS || '2000', 10);
const NOTIFY_DEDUP_TTL_SECONDS = Number.parseInt(process.env.NOTIFY_DEDUP_TTL_SECONDS || '86400', 10); // 24h
const MAX_RETRIES = Number.parseInt(process.env.STREAM_MAX_RETRIES || '5', 10);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function notifiedKey(glitchId: string) {
  return `dedup:notifications:${glitchId}`;
}

// Initialize Queue Worker
const notificationWorker = new Worker<NotificationJobData>(
  'notification-jobs',
  async (job: { data: NotificationJobData; id?: string }) => {
    const { glitch, targetTiers } = job.data;
    try {
      console.log(`Processing delayed notification for glitch ${glitch.id} (Tiers: ${targetTiers.join(', ')})`);
      await subscriberNotificationService.notifyEligibleSubscribers(glitch, targetTiers);
      await metrics.increment('notification.job.success');
    } catch (error) {
      console.error(`Failed to process notification job ${job.id}:`, error);
      await metrics.increment('notification.job.error');
      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    concurrency: 5,
  }
);

notificationWorker.on('error', (err: Error) => {
  console.error('Notification worker error:', err);
});

async function main() {
  console.log('📣 Notification sender worker starting...');
  const failures = new Map<string, number>();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const lastId = (await getKey(CURSOR_KEY)) || '0-0';
    const entries = await readStream(REDIS_KEYS.ANOMALY_CONFIRMED, lastId, BATCH_SIZE);

    if (entries.length === 0) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    for (const entry of entries) {
      try {
        const payload = entry.fields.data;
        if (!payload) {
          console.warn(`Skipping stream entry ${entry.id}: missing data field`);
          await setKey(CURSOR_KEY, entry.id);
          continue;
        }

        const glitch = JSON.parse(payload) as ValidatedGlitch;
        await metrics.increment('notification.process.start');

        const dedupKey = notifiedKey(glitch.id);
        const alreadyNotified = await getKey(dedupKey);
        if (alreadyNotified) {
          failures.delete(entry.id);
          await setKey(CURSOR_KEY, entry.id);
          continue;
        }

        // 1. Send Immediate System Broadcasts (Discord Public, Facebook Page etc)
        // Note: We might want to delay "Public" Discord too, but for now we keep broadcast separate.
        // If "Community Discord" relies on this, it's instant. Fixing that requires splitting notificationManager.
        const results = await notificationManager.notifyAll(glitch);
        
        // 2. Schedule Subscriber Notifications by Tier
        // Pro/Elite: Instant (Delay 0)
        await addNotificationJob(glitch, ['pro', 'elite'], 0);

        // Starter: 24h Delay
        await addNotificationJob(glitch, ['starter'], 24 * 60 * 60 * 1000);

        // Free: 72h Delay (Only if we want to send individual emails/alerts to free users)
        // If Free users only get Weekly Digest, we might skip this. 
        // But assuming we want to enable the capability:
        await addNotificationJob(glitch, ['free'], 72 * 60 * 60 * 1000);

        await metrics.increment('notification.process.success');
        await setKey(dedupKey, '1', NOTIFY_DEDUP_TTL_SECONDS);

        const anySuccess = Array.from(results.values()).some((r) => r.success);
        if (anySuccess) {
          try {
            const { db } = await import('@/db');
            await db.pricingAnomaly.update({
              where: { id: glitch.anomalyId },
              data: { status: 'notified' },
            });
          } catch (error) {
            console.error('Failed to mark anomaly as notified:', error);
          }
        }

        failures.delete(entry.id);
        await setKey(CURSOR_KEY, entry.id);
      } catch (error) {
        const count = (failures.get(entry.id) || 0) + 1;
        failures.set(entry.id, count);

        console.error(`Error processing confirmed glitch entry ${entry.id} (attempt ${count}/${MAX_RETRIES}):`, error);

        if (count >= MAX_RETRIES) {
          console.error(`Skipping entry ${entry.id} after ${MAX_RETRIES} failed attempts`);
          
          await moveToDLQ(
              REDIS_KEYS.ANOMALY_CONFIRMED,
              entry.id,
              entry.fields.data,
              error
          );

          failures.delete(entry.id);
          await setKey(CURSOR_KEY, entry.id);
          continue;
        }

        // Retry this entry on next loop without advancing cursor.
        break;
      }
    }

    await sleep(POLL_INTERVAL_MS);
  }
}


main().catch(async (error) => {
  console.error('Fatal notification sender error:', error);
  await import('@/lib/monitoring/alerts').then(({ alertService }) => 
    alertService.sendAlert('Fatal Notification Sender Error', error)
  );
  process.exit(1);
});

