import { readStream, getKey, setKey, REDIS_KEYS } from '@/lib/clients/redis';
import { validateAndProcess } from '@/lib/ai/validator';
import { moveToDLQ } from '@/lib/streams/dlq';
import { metrics } from '@/lib/monitoring/metrics';
import { sentry } from '@/lib/monitoring/sentry';
import { createGracefulShutdown, sleepWithShutdownCheck } from '@/lib/workers/graceful-shutdown';
import type { PricingAnomaly } from '@/types';

const CURSOR_KEY = 'cursor:stream:anomaly_detected';
const BATCH_SIZE = Number.parseInt(process.env.STREAM_BATCH_SIZE || '50', 10);
const POLL_INTERVAL_MS = Number.parseInt(process.env.STREAM_POLL_INTERVAL_MS || '2000', 10);
const MAX_RETRIES = Number.parseInt(process.env.STREAM_MAX_RETRIES || '5', 10);

// Initialize Sentry for error tracking
sentry.init();

// Initialize graceful shutdown handler
const shutdown = createGracefulShutdown({ workerName: 'anomaly-validator' });

// Track in-flight jobs for graceful shutdown
let inFlightJob: string | null = null;

async function main() {
  console.log('🔎 Anomaly validator worker starting...');
  const failures = new Map<string, number>();

  // Register cleanup for graceful shutdown
  shutdown.onShutdown(async () => {
    if (inFlightJob) {
      console.log(`[anomaly-validator] Waiting for in-flight job ${inFlightJob} to complete...`);
      // The current job will complete, then the loop will exit
    }
  });

  while (!shutdown.isInShutdown()) {
    const lastId = (await getKey(CURSOR_KEY)) || '0-0';
    const entries = await readStream(REDIS_KEYS.ANOMALY_DETECTED, lastId, BATCH_SIZE);

    if (entries.length === 0) {
      const shouldContinue = await sleepWithShutdownCheck(POLL_INTERVAL_MS, shutdown);
      if (!shouldContinue) break;
      continue;
    }

    for (const entry of entries) {
      // Check shutdown before processing each entry
      if (shutdown.isInShutdown()) {
        console.log('[anomaly-validator] Shutdown requested, stopping after current batch');
        break;
      }

      inFlightJob = entry.id;
      const jobStartTime = Date.now();

      try {
        const payload = entry.fields.data;
        if (!payload) {
          console.warn(`Skipping stream entry ${entry.id}: missing data field`);
          await setKey(CURSOR_KEY, entry.id);
          inFlightJob = null;
          continue;
        }

        const anomaly = JSON.parse(payload) as PricingAnomaly;
        await metrics.increment('anomaly.process.start');
        
        sentry.addBreadcrumb({
          category: 'worker',
          message: `Processing anomaly ${anomaly.id}`,
          level: 'info',
        });

        await validateAndProcess(anomaly);
        
        const duration = Date.now() - jobStartTime;
        await metrics.recordWorkerJob('anomaly-validator', 'success', duration);
        await metrics.increment('anomaly.process.success');

        failures.delete(entry.id);
        await setKey(CURSOR_KEY, entry.id);
      } catch (error) {
        const count = (failures.get(entry.id) || 0) + 1;
        failures.set(entry.id, count);

        const duration = Date.now() - jobStartTime;
        await metrics.recordWorkerJob('anomaly-validator', 'error', duration);

        console.error(`Error processing anomaly entry ${entry.id} (attempt ${count}/${MAX_RETRIES}):`, error);
        
        if (error instanceof Error) {
          sentry.captureException(error, {
            tags: { worker: 'anomaly-validator', entryId: entry.id },
            extra: { attempt: count, maxRetries: MAX_RETRIES },
          });
        }

        if (count >= MAX_RETRIES) {
          console.error(`Skipping entry ${entry.id} after ${MAX_RETRIES} failed attempts`);
          
          await moveToDLQ(
              REDIS_KEYS.ANOMALY_DETECTED,
              entry.id,
              entry.fields.data, // Raw payload
              error
          );

          failures.delete(entry.id);
          await setKey(CURSOR_KEY, entry.id);
          continue;
        }

        // Retry this entry on next loop without advancing cursor.
        break;
      } finally {
        inFlightJob = null;
      }
    }

    const shouldContinue = await sleepWithShutdownCheck(POLL_INTERVAL_MS, shutdown);
    if (!shouldContinue) break;
  }

  console.log('[anomaly-validator] Worker loop exited');
}

main().catch(async (error) => {
  console.error('Fatal anomaly validator error:', error);
  if (error instanceof Error) {
    sentry.captureException(error, { level: 'fatal' });
  }
  await import('@/lib/monitoring/alerts').then(({ alertService }) => 
    alertService.sendAlert('Fatal Anomaly Validator Error', error)
  );
  process.exit(1);
});
