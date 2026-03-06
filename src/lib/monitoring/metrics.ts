
import { incrementKey, getKeys, getKey as getRedisKey, setKey } from '@/lib/clients/redis';

/**
 * Production Metrics Service
 * 
 * Provides comprehensive metrics collection for:
 * - Anomaly detection rates
 * - Worker job completion times
 * - Notification delivery success rates
 * - API response times
 * 
 * Metrics are stored in Redis for real-time access and can be exported to Grafana.
 */
export class MetricsService {
  private startTimes: Map<string, number> = new Map();
  
  /**
   * Increment a counter metric
   */
  async increment(name: string, tags: Record<string, string> = {}): Promise<void> {
    const key = this.buildKey(name, tags);
    try {
      await incrementKey(key);
    } catch (err) {
      console.warn('Failed to increment metric:', err);
    }
  }

  /**
   * Increment a counter by a specific value
   */
  async incrementBy(name: string, value: number, tags: Record<string, string> = {}): Promise<void> {
    const key = this.buildKey(name, tags);
    try {
      // Use INCRBY-like operation
      const currentVal = await getRedisKey(key);
      const newVal = (parseInt(currentVal || '0', 10) + value).toString();
      await setKey(key, newVal);
    } catch (err) {
      console.warn('Failed to increment metric by value:', err);
    }
  }

  /**
   * Start timing an operation
   */
  startTimer(operationId: string): void {
    this.startTimes.set(operationId, Date.now());
  }

  /**
   * End timing and record the duration
   */
  async endTimer(operationId: string, metricName: string, tags: Record<string, string> = {}): Promise<number> {
    const startTime = this.startTimes.get(operationId);
    if (!startTime) {
      console.warn(`No start time found for operation: ${operationId}`);
      return 0;
    }
    
    const duration = Date.now() - startTime;
    this.startTimes.delete(operationId);
    
    await this.recordDuration(metricName, duration, tags);
    return duration;
  }

  /**
   * Record a duration metric
   */
  async recordDuration(name: string, durationMs: number, tags: Record<string, string> = {}): Promise<void> {
    const key = this.buildKey(`${name}.duration`, tags);
    const countKey = this.buildKey(`${name}.count`, tags);
    const sumKey = this.buildKey(`${name}.sum`, tags);
    
    try {
      await incrementKey(countKey);
      const currentSum = await getRedisKey(sumKey);
      const newSum = (parseInt(currentSum || '0', 10) + durationMs).toString();
      await setKey(sumKey, newSum);
    } catch (err) {
      console.warn('Failed to record duration:', err);
    }
  }

  /**
   * Record a gauge metric (point-in-time value)
   */
  async gauge(name: string, value: number, tags: Record<string, string> = {}): Promise<void> {
    const key = this.buildKey(name, tags);
    try {
      await setKey(key, value.toString());
    } catch (err) {
      console.warn('Failed to set gauge:', err);
    }
  }

  /**
   * Get all metrics for export
   */
  async getMetrics(): Promise<Record<string, number>> {
    try {
      const keys = await getKeys('metrics:*');
      const stats: Record<string, number> = {};
      
      // Note: This is O(N) where N is number of metrics. 
      // In production, use MGET or pipelining if possible.
      for (const key of keys) {
        const val = await getRedisKey(key);
        if (val) stats[key] = parseInt(val, 10);
      }
      return stats;
    } catch (err) {
      console.error('Failed to get metrics:', err);
      return {};
    }
  }

  /**
   * Get formatted metrics for Prometheus/Grafana export
   */
  async getPrometheusMetrics(): Promise<string> {
    const allMetrics = await this.getMetrics();
    const lines: string[] = [];
    
    for (const [key, value] of Object.entries(allMetrics)) {
      // Convert Redis key to Prometheus format
      // metrics:name:tag1=val1 -> pricehawk_name{tag1="val1"} value
      const parts = key.replace('metrics:', '').split(':');
      const name = parts[0].replace(/\./g, '_');
      const tags = parts.slice(1);
      
      let labelStr = '';
      if (tags.length > 0) {
        const labels = tags.map(t => {
          const [k, v] = t.split('=');
          return `${k}="${v}"`;
        }).join(',');
        labelStr = `{${labels}}`;
      }
      
      lines.push(`pricehawk_${name}${labelStr} ${value}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Record worker job metrics
   */
  async recordWorkerJob(
    workerName: string,
    status: 'start' | 'success' | 'error',
    durationMs?: number
  ): Promise<void> {
    await this.increment(`worker.job.${status}`, { worker: workerName });
    
    if (durationMs !== undefined && status !== 'start') {
      await this.recordDuration('worker.job', durationMs, { worker: workerName });
    }
  }

  /**
   * Record notification delivery metrics
   */
  async recordNotification(
    channel: string,
    status: 'sent' | 'failed' | 'queued'
  ): Promise<void> {
    await this.increment(`notification.${status}`, { channel });
  }

  /**
   * Record anomaly detection metrics
   */
  async recordAnomaly(
    type: string,
    isConfirmed: boolean,
    confidence: number
  ): Promise<void> {
    await this.increment('anomaly.detected', { type, confirmed: isConfirmed.toString() });
    
    if (isConfirmed) {
      await this.increment('anomaly.confirmed', { type });
    }
  }

  /**
   * Record API call metrics
   */
  async recordApiCall(
    endpoint: string,
    status: 'success' | 'error',
    durationMs: number
  ): Promise<void> {
    await this.increment(`api.call.${status}`, { endpoint });
    await this.recordDuration('api.call', durationMs, { endpoint });
  }

  private buildKey(name: string, tags: Record<string, string>): string {
    const tagString = Object.entries(tags)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`)
      .join(':');
    
    // Format: metrics:name:tag1=val1:tag2=val2
    return `metrics:${name}${tagString ? ':' + tagString : ''}`;
  }
}

export const metrics = new MetricsService();
