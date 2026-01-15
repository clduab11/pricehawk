import { Queue } from 'bullmq';
import { ValidatedGlitch } from '@/types';
import { SubscriptionTier } from '@/lib/subscription';

export interface NotificationJobData {
  glitch: ValidatedGlitch;
  targetTiers: SubscriptionTier[];
}

export const notificationQueue = new Queue('notification-jobs', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export const addNotificationJob = async (
  glitch: ValidatedGlitch,
  targetTiers: SubscriptionTier[],
  delayMs: number
) => {
  const jobId = `notify-${glitch.id}-${targetTiers.join('-')}`;
  await notificationQueue.add(
    jobId,
    { glitch, targetTiers },
    { 
      delay: delayMs,
      jobId 
    }
  );
};
