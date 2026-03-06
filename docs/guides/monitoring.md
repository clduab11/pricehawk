# Monitoring & Alerting

This guide covers the observability stack for PriceHawk production deployments.

## Overview

PriceHawk uses a layered monitoring approach:

1. **Health Checks**: Container-level health verification
2. **Metrics**: Redis-based counters with Prometheus export
3. **Error Tracking**: Sentry integration for exception monitoring
4. **Alerting**: Discord webhooks for critical alerts
5. **Dashboards**: Grafana visualizations

## Health Checks

### Application Health

```
GET /api/health
```

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-20T12:00:00Z",
  "components": {
    "database": "connected",
    "redis": "connected",
    "workers": {
      "anomaly-validator": "running",
      "notification-sender": "running"
    }
  }
}
```

### Docker Health Checks

All services in docker-compose.yml include health checks:

| Service | Health Check | Interval | Timeout |
|---------|--------------|----------|---------|
| PostgreSQL | `pg_isready` | 10s | 5s |
| Redis | `redis-cli ping` | 10s | 5s |
| App | `curl /api/health` | 30s | 10s |
| Workers | `pgrep -f <worker>` | 30s | 10s |

## Metrics

### Available Metrics

PriceHawk exports metrics in Prometheus format at `/api/internal/metrics`:

#### Anomaly Detection
- `pricehawk_anomaly_detected` - Total anomalies detected
- `pricehawk_anomaly_confirmed` - Anomalies confirmed by AI
- `pricehawk_anomaly_process_success` - Successfully processed
- `pricehawk_anomaly_process_error` - Processing failures

#### Worker Performance
- `pricehawk_worker_job_start` - Jobs started by worker
- `pricehawk_worker_job_success` - Jobs completed successfully
- `pricehawk_worker_job_error` - Jobs failed
- `pricehawk_worker_job_duration_sum` - Total processing time (ms)
- `pricehawk_worker_job_duration_count` - Number of jobs timed

#### Notifications
- `pricehawk_notification_sent` - Notifications delivered
- `pricehawk_notification_failed` - Delivery failures
- `pricehawk_notification_queued` - Notifications in queue

#### API Performance
- `pricehawk_api_call_success` - Successful API calls
- `pricehawk_api_call_error` - Failed API calls
- `pricehawk_api_call_duration_sum` - Total response time (ms)

### Metrics Labels

Metrics include dimensional labels:
- `worker`: anomaly-validator, notification-sender, deal-verifier, etc.
- `channel`: discord, email, sms, telegram, whatsapp
- `endpoint`: openrouter, jina-reader, twilio, etc.
- `type`: decimal_error, z_score, mad_score, percentage_drop

## Sentry Error Tracking

### Configuration

```bash
# .env
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_RELEASE=pricehawk@1.0.0
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Integration

Sentry is initialized in workers and API routes:

```typescript
import { sentry } from '@/lib/monitoring/sentry';

// Initialize at startup
sentry.init();

// Capture exceptions
try {
  await processAnomaly(data);
} catch (error) {
  sentry.captureException(error, {
    tags: { worker: 'anomaly-validator' },
    extra: { anomalyId: data.id }
  });
  throw error;
}
```

### Tracked Events

- Worker crashes and fatal errors
- API 5xx responses
- Database connection failures
- External API errors (OpenRouter, Twilio, etc.)
- Queue processing failures

## Grafana Dashboards

### Recommended Dashboard Panels

#### 1. System Overview
- Worker uptime status (status panel)
- Anomalies detected per hour (time series)
- Notification delivery success rate (gauge)
- Active alerts (alert list)

#### 2. Anomaly Detection
- Anomalies by type (pie chart)
- Detection latency (histogram)
- Confidence score distribution (bar chart)
- False positive rate (single stat)

#### 3. Worker Performance
- Job processing times by worker (time series)
- Queue backlog size (gauge)
- DLQ size (single stat)
- Error rate by worker (bar chart)

#### 4. Notification Delivery
- Delivery success rate by channel (bar chart)
- Notification latency (histogram)
- Channel availability (status panel)
- Delivery volume over time (stacked area)

#### 5. External APIs
- OpenRouter response times (time series)
- API error rates (bar chart)
- Rate limit status (gauge)
- Cost tracking (single stat)

### Prometheus Queries

```promql
# Anomaly detection rate
rate(pricehawk_anomaly_detected[5m])

# Worker error rate
rate(pricehawk_worker_job_error[5m]) / rate(pricehawk_worker_job_start[5m])

# Notification success rate
pricehawk_notification_sent / (pricehawk_notification_sent + pricehawk_notification_failed)

# Average job duration
pricehawk_worker_job_duration_sum / pricehawk_worker_job_duration_count

# Queue backlog
pricehawk_worker_job_start - pricehawk_worker_job_success - pricehawk_worker_job_error
```

## Alerting

### Discord Alerts

Critical alerts are sent to Discord via webhook:

```bash
# .env
DISCORD_ALERTS_WEBHOOK_URL=https://discord.com/api/webhooks/xxx
```

### Alert Rules

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| Worker Offline | Health check fails > 5 min | Critical | Restart worker |
| High Error Rate | Error rate > 10% for 5 min | Warning | Investigate logs |
| Database Pool Exhausted | Pool available = 0 | Critical | Scale database |
| Queue Backlog | Pending > 100 for 10 min | Warning | Scale workers |
| Redis OOM | Memory > 90% | Critical | Increase memory/eviction |
| False Positive Rate | FP > 25% for 1 hour | Warning | Review thresholds |
| API Latency | P95 > 5s for 5 min | Warning | Check external APIs |

### Alert Configuration

```typescript
// src/lib/monitoring/alerts.ts
const alertThresholds = {
  workerOfflineMinutes: 5,
  errorRatePercent: 10,
  queueBacklogSize: 100,
  redisMemoryPercent: 90,
  falsePositiveRatePercent: 25,
  apiLatencyP95Ms: 5000,
};
```

## Logging

### Log Format

Workers and API routes log in structured JSON:

```json
{
  "timestamp": "2026-01-20T12:00:00Z",
  "level": "info",
  "worker": "anomaly-validator",
  "message": "Processed anomaly",
  "anomalyId": "abc123",
  "duration": 1234,
  "confidence": 85
}
```

### Log Levels

| Level | Usage |
|-------|-------|
| `error` | Exceptions, failures, critical issues |
| `warn` | Recoverable issues, deprecations |
| `info` | Normal operations, job completions |
| `debug` | Detailed diagnostic information |

### Viewing Logs

```bash
# Docker Compose
docker-compose logs -f worker-validator

# Railway
railway logs --filter worker-validator

# JSON parsing with jq
docker-compose logs worker-validator | jq -r 'select(.level=="error")'
```

## Audit Logging

All critical operations are logged to the `AuditLog` table:

```sql
SELECT * FROM audit_logs 
WHERE action = 'glitch.detected' 
ORDER BY created_at DESC 
LIMIT 100;
```

### Logged Actions

- `anomaly.detected` - New anomaly found
- `glitch.confirmed` - AI validated as genuine
- `notification.sent` - User notified
- `affiliate.click` - Affiliate link clicked
- `subscription.created` - New subscription
- `subscription.cancelled` - Subscription cancelled

## Best Practices

1. **Set Up Alerts Early**: Configure alerts before production launch
2. **Monitor Queue Sizes**: Growing queues indicate processing issues
3. **Track Error Rates**: Trend over time, not just absolute values
4. **Use Dashboards**: Create role-specific views (ops, business)
5. **Retain Logs**: Keep logs for at least 30 days
6. **Test Alerts**: Periodically verify alert delivery works
