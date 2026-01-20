# Troubleshooting Workers

This runbook provides guidance for diagnosing and resolving issues with PriceHawk workers.

## Worker Overview

PriceHawk uses 6 worker processes:

| Worker | Purpose | Queue/Stream |
|--------|---------|--------------|
| `anomaly-validator` | Validates detected anomalies with AI | Redis Stream: `anomaly_detected` |
| `notification-sender` | Sends notifications to users | Redis Stream: `anomaly_confirmed` |
| `deal-verifier` | Re-checks active deals for expiration | BullMQ: `deal-verifier` |
| `social-poster` | Posts deals to social media | BullMQ: `social-jobs` |
| `newsletter-digest` | Generates daily/weekly digests | BullMQ: `newsletter-jobs` |
| `telegram-bot` | Handles Telegram bot commands | Telegraf polling |

## Quick Diagnostics

### Check Worker Status (Docker)

```bash
# List all workers and their status
docker-compose ps

# Check logs for a specific worker
docker-compose logs -f worker-validator

# Check health of all workers
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"
```

### Check Worker Status (Railway)

```bash
# View deployment status
railway status

# View logs
railway logs --tail 100
```

## Common Issues

### 1. Worker Not Starting

**Symptoms**:
- Container exits immediately
- Health check failing
- No logs being produced

**Diagnosis**:
```bash
# Check recent logs
docker-compose logs --tail 50 worker-validator

# Check container status
docker inspect worker-validator | grep -A 5 "State"
```

**Common Causes**:

1. **Missing Environment Variables**
   ```bash
   # Run environment validation
   npm run validate:env
   ```

2. **Database Connection Failed**
   - Check DATABASE_URL is correct
   - Verify PostgreSQL is running: `docker-compose ps postgres`
   - Check connection pool exhaustion

3. **Redis Connection Failed**
   - Check REDIS_HOST and REDIS_PORT
   - Verify Redis is running: `docker-compose ps redis`
   - Check Redis memory: `redis-cli INFO memory`

4. **Prisma Client Not Generated**
   ```bash
   npm run prisma:generate
   ```

### 2. Worker Processing Slowly

**Symptoms**:
- Queue backlog growing
- High job processing times
- Timeout errors

**Diagnosis**:
```bash
# Check queue status (Redis CLI)
redis-cli XLEN pricehawk:stream:anomaly_detected
redis-cli XLEN pricehawk:stream:anomaly_confirmed

# Check BullMQ queue metrics
redis-cli LLEN bull:notification-jobs:wait
redis-cli LLEN bull:notification-jobs:active
```

**Common Causes**:

1. **AI API Rate Limiting**
   - Check OpenRouter rate limits
   - Increase `STREAM_POLL_INTERVAL_MS`
   - Enable circuit breaker backoff

2. **Database Slow Queries**
   - Check `DATABASE_POOL_MAX` setting
   - Review slow query logs
   - Consider adding indexes

3. **Memory Pressure**
   - Check container memory usage
   - Increase container limits in docker-compose.yml
   - Review batch sizes: `STREAM_BATCH_SIZE`

### 3. Jobs Stuck in Dead Letter Queue

**Symptoms**:
- Jobs failing repeatedly
- Accumulation in DLQ
- Same error repeated in logs

**Diagnosis**:
```bash
# Check DLQ size
redis-cli LLEN pricehawk:dlq:anomaly_detected
redis-cli LLEN pricehawk:dlq:anomaly_confirmed

# View DLQ entries
redis-cli LRANGE pricehawk:dlq:anomaly_detected 0 10
```

**Resolution**:

1. **Investigate Error Pattern**
   ```bash
   # Parse DLQ entry to see error
   redis-cli LINDEX pricehawk:dlq:anomaly_detected 0 | jq .error
   ```

2. **Retry Jobs Manually**
   ```bash
   # Move job back to main queue (after fixing root cause)
   redis-cli RPOPLPUSH pricehawk:dlq:anomaly_detected pricehawk:stream:anomaly_detected
   ```

3. **Clear DLQ (if jobs are invalid)**
   ```bash
   redis-cli DEL pricehawk:dlq:anomaly_detected
   ```

### 4. Worker Crashes During Shutdown

**Symptoms**:
- Jobs lost during deployment
- Duplicate processing after restart
- Inconsistent cursor state

**Diagnosis**:
```bash
# Check last cursor position
redis-cli GET cursor:stream:anomaly_detected

# Check for orphaned jobs
redis-cli XPENDING pricehawk:stream:anomaly_detected
```

**Resolution**:

1. **Ensure Graceful Shutdown**
   - Workers should finish in-flight jobs before exit
   - Check `GRACEFUL_SHUTDOWN_TIMEOUT` is set (default: 30000ms)
   - Docker Compose: `stop_grace_period: 30s`

2. **Reset Cursor (if needed)**
   ```bash
   # Find last processed entry
   redis-cli XINFO GROUPS pricehawk:stream:anomaly_detected
   
   # Reset to specific position
   redis-cli SET cursor:stream:anomaly_detected "1234567890-0"
   ```

### 5. Notification Delivery Failures

**Symptoms**:
- Notifications not reaching users
- High error rate in notification metrics
- Channel-specific failures

**Diagnosis**:
```bash
# Check notification metrics
redis-cli KEYS "metrics:notification.*"
redis-cli GET metrics:notification.failed:channel=discord

# Check notification queue
redis-cli LLEN bull:notification-jobs:failed
```

**Common Causes by Channel**:

| Channel | Common Issues | Resolution |
|---------|---------------|------------|
| Discord | Webhook URL expired | Regenerate webhook in Discord server settings |
| Email | Resend rate limit | Check Resend dashboard, increase plan |
| SMS | Twilio balance low | Add credits to Twilio account |
| Telegram | Bot blocked by user | User must unblock bot |
| WhatsApp | Template not approved | Resubmit template for approval |

### 6. High False Positive Rate

**Symptoms**:
- Users reporting irrelevant deals
- Low AI confidence scores
- Normal sales flagged as anomalies

**Diagnosis**:
```bash
# Check detection metrics
redis-cli GET metrics:anomaly.confirmed
redis-cli GET metrics:anomaly.detected

# Calculate FP rate
# FP Rate = 1 - (confirmed / detected)
```

**Resolution**:

1. **Adjust Category Thresholds**
   - Review `src/lib/analysis/thresholds.ts`
   - Increase `dropThreshold` for over-sensitive categories
   - Increase `madThreshold` for more tolerance

2. **Improve AI Validation**
   - Check `ENABLE_SOTA_MODELS=true` for critical categories
   - Review AI prompt in `src/lib/ai/validator.ts`

3. **Add Historical Data**
   - Ensure sufficient price history (30+ samples for Z-score)
   - Run backfill for new products

## Performance Tuning

### Recommended Settings by Scale

| Metric | Low (< 100 products) | Medium (100-1000) | High (1000+) |
|--------|---------------------|-------------------|--------------|
| `STREAM_BATCH_SIZE` | 10 | 50 | 100 |
| `STREAM_POLL_INTERVAL_MS` | 5000 | 2000 | 1000 |
| `DATABASE_POOL_MIN` | 5 | 10 | 20 |
| `DATABASE_POOL_MAX` | 10 | 30 | 50 |
| Worker Replicas | 1 | 1-2 | 2-3 |

### Memory Optimization

```yaml
# docker-compose.yml worker settings
deploy:
  resources:
    limits:
      memory: 512M
    reservations:
      memory: 256M
```

### CPU Optimization

```yaml
# docker-compose.yml worker settings
deploy:
  resources:
    limits:
      cpus: '0.5'
    reservations:
      cpus: '0.25'
```

## Monitoring Alerts

Configure these alerts for proactive monitoring:

| Alert | Condition | Severity |
|-------|-----------|----------|
| Worker Offline | Health check fails > 5 min | Critical |
| Queue Backlog | Pending jobs > 100 | Warning |
| High Error Rate | Error rate > 10% | Warning |
| DLQ Growing | DLQ size > 50 | Warning |
| Memory Pressure | Memory > 80% | Warning |
| Database Pool Exhausted | Available = 0 | Critical |

## Recovery Procedures

### Full Worker Restart

```bash
# Graceful restart
docker-compose restart worker-validator

# Force restart (if graceful fails)
docker-compose kill worker-validator
docker-compose up -d worker-validator
```

### Reset Worker State

```bash
# Clear all cursors (start from scratch)
redis-cli KEYS "cursor:*" | xargs redis-cli DEL

# Clear metrics (start fresh)
redis-cli KEYS "metrics:*" | xargs redis-cli DEL

# Clear DLQ (after investigation)
redis-cli KEYS "pricehawk:dlq:*" | xargs redis-cli DEL
```

### Database Connection Pool Recovery

```bash
# Check current connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'pricehawk';"

# Kill idle connections
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'pricehawk' AND state = 'idle' AND query_start < now() - interval '5 minutes';"
```

## Escalation

If issues persist after following this runbook:

1. Check Sentry for detailed error traces
2. Review Grafana dashboards for anomalies
3. Check external service status pages:
   - [OpenRouter Status](https://openrouter.ai/status)
   - [Stripe Status](https://status.stripe.com)
   - [Clerk Status](https://status.clerk.dev)
   - [Twilio Status](https://status.twilio.com)
4. Contact @clduab11 for further investigation
