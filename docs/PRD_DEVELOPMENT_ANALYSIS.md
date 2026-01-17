# PriceHawk PRD Development Analysis

**Generated:** January 17, 2026
**Repository:** clduab11/pricehawk
**Analysis Type:** Recursive Repository Analysis for PRD Production

---

## Executive Summary

PriceHawk is an enterprise-grade pricing error detection and monetization platform that monitors 100+ retailers 24/7 for pricing anomalies (glitches), validates them using AI, and delivers instant notifications to subscribers. The system follows an event-driven architecture with Redis Streams as the message broker.

**Current State:** Feature-complete beta transitioning to production (target: February 28, 2026)
**User Target:** 10-50 initial users with subscription tiers (Free → Elite)
**Architecture:** Next.js 14 + PostgreSQL + Redis + Multi-provider AI validation

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Critical Development Gaps](#2-critical-development-gaps)
3. [Targeted Development Areas](#3-targeted-development-areas)
4. [PRD Recommendations by Priority](#4-prd-recommendations-by-priority)
5. [Technical Debt Assessment](#5-technical-debt-assessment)
6. [Feature Roadmap Opportunities](#6-feature-roadmap-opportunities)
7. [Infrastructure Improvements](#7-infrastructure-improvements)
8. [Implementation Effort Estimates](#8-implementation-effort-estimates)

---

## 1. Architecture Overview

### Core System Flow
```
Detection → Redis Stream → Validation → Notification → Multi-Channel Delivery
Firecrawl    (Dedup)       (DeepSeek)    (Routing)    (Discord/SMS/Email/etc)
    ↓           ↓              ↓            ↓            ↓
PostgreSQL ← Prisma ORM ← Event Pipeline ← Notification Manager ← User Prefs
```

### Technology Stack Summary

| Layer | Technology | Status |
|-------|------------|--------|
| Framework | Next.js 14 (App Router) | Production-ready |
| Database | PostgreSQL 15 + Prisma 7.2 | Production-ready |
| Cache/Queue | Redis 7 / Upstash | Production-ready |
| Auth | Clerk | Production-ready |
| Payments | Stripe | Needs testing |
| AI Validation | OpenRouter/DeepSeek V3 | Production-ready |
| Scraping | Firecrawl + Jina (fallback) | Needs improvements |
| Notifications | 8 providers (Discord, SMS, Email, etc.) | Production-ready |

### Database Schema (14 Primary Tables)

| Table | Records | Purpose |
|-------|---------|---------|
| users | - | Clerk-synced user accounts |
| subscriptions | - | Tier tracking (free/starter/pro/elite) |
| user_preferences | - | Notification settings, categories, retailers |
| products | - | Scraped product data |
| price_history | - | Historical pricing for anomaly detection |
| anomalies | - | Detected pricing anomalies |
| validated_glitches | - | AI-confirmed glitches |
| notifications | - | Delivery records |
| scheduled_jobs | - | Cron task configurations |
| job_runs | - | Job execution history |
| audit_logs | - | Compliance tracking |
| api_usage | - | Rate limiting |
| social_posts | - | Social media posts |
| newsletter_issues | - | Newsletter records |

---

## 2. Critical Development Gaps

### 2.1 Code-Level Incomplete Features

#### TODO Items Found (1 critical)
| File | Line | Issue | Priority |
|------|------|-------|----------|
| `src/workers/deal-verifier.ts` | 77 | Missing re-scrape implementation | **HIGH** |

```typescript
// Current: Mock implementation
console.log(`[Mock] Verifying ${data.url} - logic would re-scrape here.`);
// TODO: Implement actual re-Scrape logic here or call a shared service.
```

**Impact:** Deal expiration detection is non-functional, leading to potentially stale deals being promoted.

### 2.2 Launch Checklist Gaps (From LAUNCH_CHECKLIST.md)

| Area | Status | Items Incomplete |
|------|--------|------------------|
| Stripe Billing | ❌ Untested | Functional testing needed |
| User Dashboard | ❌ Incomplete | Accessibility validation |
| Historical Deal Browser | ❌ Missing | Feature not implemented |
| Security Checklist | ⚠️ Partial | Rate limiting, data encryption |
| Monitoring Setup | ❌ Missing | Error tracking, uptime monitoring |

### 2.3 Testing Coverage Gaps

**Current Test Files (8 total, ~1,284 lines):**
- `subscription.test.ts` - Tier logic
- `detection.test.ts` - Anomaly detection algorithms
- `thresholds.test.ts` - Category thresholds
- `extractor.test.ts` - Content extraction
- `jina-reader.test.ts` - Jina scraper
- `subscriber-service.test.ts` - Notification routing
- `affiliate.test.ts` - Affiliate tracking
- `jina-worker.test.ts` - Worker testing

**Missing Test Coverage:**
- API endpoint integration tests
- Worker pipeline end-to-end tests
- Stripe webhook handling tests
- Multi-channel notification delivery tests
- AI validation fallback logic tests
- Critical user journey tests (signup → subscription → notification)

---

## 3. Targeted Development Areas

### Area 1: Scraping Reliability & Accuracy

**Current Issues:**
- Occasional missed deals due to retailer site changes
- Anti-bot detection causing rate limiting/blocking
- Limited retailer coverage
- Performance bottlenecks in sequential scraping

**Development Targets:**

| Target | Description | Files Affected |
|--------|-------------|----------------|
| Fallback Selectors | Primary + 2 fallback selectors per retailer | `src/lib/scraping/*.ts` |
| Circuit Breaker | 50% failure rate threshold, 15-min pause | `src/scrapers/orchestrator.ts` |
| Parallel Scraping | Increase from 5 to 10 concurrent jobs | `src/scrapers/orchestrator.ts` |
| User-Agent Rotation | Pool of 10+ realistic user agents | `src/scrapers/playwright-worker.ts` |
| Rate Limiting | Per-retailer adaptive rate limits | `src/scrapers/proxy-manager.ts` |
| Retailer Expansion | Add Home Depot, Lowe's, Newegg | New config files |

**Success Criteria:**
- 95%+ deal detection rate
- < 5% anti-bot blocking rate
- 50% faster scraping cycles

---

### Area 2: Deal Verification & Expiration

**Current Issues:**
- `deal-verifier.ts` has mock implementation only
- No real-time deal validity checking
- Stale deals may be promoted to users

**Development Targets:**

| Target | Description | Files Affected |
|--------|-------------|----------------|
| Re-Scrape Service | Implement actual re-scraping for deal verification | `src/workers/deal-verifier.ts` |
| Expiration Detection | Use existing `analysis/expiration.ts` properly | `src/lib/analysis/expiration.ts` |
| Status Tracking | Update anomaly status (expired/valid/unknown) | `prisma/schema.prisma` |
| Notification Integration | Alert users when tracked deals expire | `src/lib/notifications/` |

**Implementation Approach:**
```typescript
// Proposed: src/workers/deal-verifier.ts
async function verifyDeal(data: DealVerificationJob): Promise<void> {
  const product = await scrapeUrl(data.url);

  if (!product || product.price !== data.originalPrice) {
    await markDealExpired(data.anomalyId);
    await notifySubscribers(data.anomalyId, 'DEAL_EXPIRED');
  } else {
    await updateLastVerified(data.anomalyId);
  }
}
```

---

### Area 3: AI Validation Enhancement

**Current State:**
- Single provider (OpenRouter/DeepSeek V3)
- Rule-based fallback exists
- No Gemini integration (planned per tech-plan.md)

**Development Targets:**

| Target | Description | Files Affected |
|--------|-------------|----------------|
| Multi-Provider Strategy | Gemini primary, DeepSeek fallback | `src/lib/ai/validator.ts` |
| Provider Abstraction | Interface-based provider pattern | New: `src/lib/ai/providers/` |
| Retry Logic | Exponential backoff (2 retries, 1s/2s/4s) | `src/lib/ai/validator.ts` |
| Validation Metrics | Track success rate by provider | `src/lib/monitoring/metrics.ts` |

**Provider Architecture:**
```typescript
interface AIProvider {
  name: string;
  validate(anomaly: PricingAnomaly): Promise<ValidationResult>;
  isAvailable(): Promise<boolean>;
}

// Implementations needed:
// - GeminiProvider (Google AI Studio)
// - DeepSeekProvider (OpenRouter - existing)
// - RuleBasedProvider (existing fallback)
```

---

### Area 4: Monitoring & Observability

**Current State:**
- Basic metrics service (`src/lib/monitoring/metrics.ts`)
- Discord-only alerts (`src/lib/monitoring/alerts.ts`)
- No structured logging
- No performance tracking

**Development Targets:**

| Target | Description | Files Affected |
|--------|-------------|----------------|
| Prometheus Integration | Push metrics from Cloud Run | `src/lib/monitoring/metrics.ts` |
| Structured Logging | JSON logs with correlation IDs | All source files |
| Multi-Channel Alerts | Email + Discord (critical alerts) | `src/lib/monitoring/alerts.ts` |
| Grafana Dashboards | Visualize key metrics | External config |
| Health Endpoint Enhancement | Detailed `/api/internal/status` | `src/app/api/health/route.ts` |

**Metrics to Track:**
- Scraping: success rate, duration, errors by retailer
- Detection: anomalies detected, validation rate, false positive rate
- Notifications: delivery rate by channel, latency by tier
- System: API response times, queue depth, worker health
- Business: active subscriptions, deals/hour, user engagement

**Alert Thresholds:**
| Severity | Condition |
|----------|-----------|
| Critical | Error rate > 5%, health check failures, worker crashes |
| Warning | Scraping success < 80%, notification delivery < 90%, queue > 100 |

---

### Area 5: Production Infrastructure

**Current State:**
- Docker development setup exists
- CI/CD via GitHub Actions (8 workflows)
- No automated production deployment
- No rollback procedures

**Development Targets:**

| Target | Description | Files Affected |
|--------|-------------|----------------|
| GCP Deployment | Cloud Run (app) + Compute Engine (workers) | `.github/workflows/` |
| Smoke Tests | Critical path validation post-deploy | New: `tests/smoke/` |
| Rollback Automation | Git revert + auto-deploy | `.github/workflows/release.yml` |
| Deployment Tracking | Database table for deployment history | `prisma/schema.prisma` |
| Health Monitoring | Prometheus + Grafana Cloud | New configs |

**Proposed CI/CD Pipeline:**
```
Build → Test → Docker Push → Deploy Cloud Run → Deploy Workers → Smoke Tests → Monitor
                                  ↓                    ↓              ↓
                              [Rollback] ←←←←←← [Failure Detection]
```

---

### Area 6: Billing & Subscription

**Current State:**
- Stripe integration exists (`src/lib/subscription.ts`)
- Webhook handler exists (`src/app/api/webhooks/stripe/route.ts`)
- 4 tiers defined (Free/Starter/Pro/Elite)
- **Status: Untested per launch checklist**

**Development Targets:**

| Target | Description | Files Affected |
|--------|-------------|----------------|
| Integration Testing | End-to-end Stripe flow tests | New: `tests/integration/stripe.test.ts` |
| Billing Portal | Verify customer portal functionality | `src/app/api/billing/portal/route.ts` |
| Webhook Validation | Test all webhook event types | `src/app/api/webhooks/stripe/route.ts` |
| Subscription Sync | Ensure Clerk ↔ Stripe sync works | `src/lib/subscription.ts` |
| Launch Period Logic | Verify 60-day free trial (Feb 1 - Apr 1, 2026) | `src/lib/subscription.ts` |

---

### Area 7: User Dashboard & Experience

**Current State:**
- Dashboard exists at `/dashboard`
- Preferences form exists (`PreferencesForm.tsx`)
- Hot deals feed at `/dashboard/hot`
- **Historical deal browser: Missing**

**Development Targets:**

| Target | Description | Files Affected |
|--------|-------------|----------------|
| Historical Browser | Search/filter past deals | New: `/dashboard/history` |
| Deal Filtering | By category, retailer, date, discount | `src/app/dashboard/` |
| Saved Deals | User bookmark functionality | Schema + UI changes |
| Price Alerts | Custom price target notifications | New feature |
| Mobile Responsiveness | Verify all dashboard views | CSS/Tailwind updates |

---

### Area 8: Error Handling & Resilience

**Current State:**
- Basic try/catch in most handlers
- DLQ for failed worker items
- No circuit breakers
- Inconsistent retry logic

**Development Targets:**

| Target | Description | Files Affected |
|--------|-------------|----------------|
| Circuit Breaker Pattern | Per-service circuit breakers | New: `src/lib/resilience/circuit-breaker.ts` |
| Retry Standardization | Consistent exponential backoff | All workers |
| Graceful Degradation | Fallbacks for all external services | All API clients |
| Error Categorization | Transient vs permanent errors | Error handling code |

**Retry Strategy by Service:**
| Service | Max Retries | Backoff | Fallback |
|---------|-------------|---------|----------|
| Scraping | 3 | 1s, 2s, 4s | Skip retailer |
| AI Validation | 2 | 5s delay | Rule-based |
| Notifications | 3 | Exponential | DLQ |
| Database | 2 | 1s delay | Alert + fail |
| Stripe/Clerk | 2 | 2s delay | Alert |

---

## 4. PRD Recommendations by Priority

### P0: Launch Blockers (Must Complete Before Feb 28, 2026)

| Item | Effort | Owner |
|------|--------|-------|
| Implement deal-verifier re-scrape logic | 2 days | Backend |
| Complete Stripe billing testing | 1 day | Full-stack |
| Add critical path integration tests | 3 days | Backend |
| Set up production monitoring (Prometheus/Grafana) | 2 days | DevOps |
| Create operational runbooks | 2 days | Documentation |
| Security checklist completion | 1 day | Security |

### P1: High Priority (Week 1-2 Post-Launch)

| Item | Effort | Owner |
|------|--------|-------|
| Scraping reliability improvements | 3 days | Backend |
| Circuit breaker implementation | 2 days | Backend |
| Multi-provider AI validation | 2 days | Backend |
| Structured logging | 2 days | Backend |
| Email alerts for critical issues | 1 day | Backend |

### P2: Medium Priority (Month 1)

| Item | Effort | Owner |
|------|--------|-------|
| Historical deal browser | 3 days | Frontend |
| Performance optimization | 3 days | Backend |
| Retailer coverage expansion | 5 days | Backend |
| Comprehensive test suite | 5 days | QA |
| User feedback integration | 2 days | Product |

### P3: Future Roadmap (Post Month 1)

| Item | Effort | Owner |
|------|--------|-------|
| Mobile React Native app | 4 weeks | Mobile |
| Push notifications | 2 weeks | Mobile |
| International retailer support | 6 weeks | Backend |
| Advanced analytics dashboard | 3 weeks | Full-stack |
| Machine learning price prediction | 8 weeks | ML |

---

## 5. Technical Debt Assessment

### High Severity

| Issue | Location | Remediation |
|-------|----------|-------------|
| Mock deal verification | `src/workers/deal-verifier.ts:77` | Implement actual logic |
| Console.log debugging | 54 files with error handlers | Replace with structured logging |
| Hardcoded configurations | Various `.ts` files | Move to environment variables |

### Medium Severity

| Issue | Location | Remediation |
|-------|----------|-------------|
| Duplicate error handling | All API routes | Create shared error handler |
| Missing retry logic standardization | Workers | Implement resilience library |
| Inconsistent response formats | API endpoints | Create response builder |

### Low Severity

| Issue | Location | Remediation |
|-------|----------|-------------|
| Missing JSDoc comments | Most functions | Add documentation |
| Unused imports | Various files | ESLint cleanup |
| Test coverage gaps | 8 test files only | Expand test suite |

---

## 6. Feature Roadmap Opportunities

### Short-Term (1-3 Months)

1. **Price Alert Customization**
   - User-defined price thresholds
   - "Notify me when X drops below $Y"
   - Integration with user preferences

2. **Deal Quality Scoring**
   - Combine Z-score, AI confidence, historical data
   - Surface "best deals" prominently
   - Personalized deal ranking

3. **Social Proof Integration**
   - Show "X users tracking this deal"
   - User comments/reviews on deals
   - Upvote/downvote system

### Medium-Term (3-6 Months)

4. **Browser Extension**
   - Automatic price checking on product pages
   - One-click deal tracking
   - Price history overlay

5. **Affiliate Revenue Dashboard**
   - Track clicks, conversions, revenue
   - Per-deal ROI metrics
   - Partner network expansion

6. **API for Power Users**
   - RESTful API for Elite tier
   - Webhook integrations
   - Custom deal filters

### Long-Term (6-12 Months)

7. **Mobile Applications**
   - iOS/Android native apps
   - Push notifications
   - Barcode scanning

8. **International Expansion**
   - Multi-currency support
   - Regional retailer databases
   - Localized notifications

9. **ML-Powered Predictions**
   - Price trend forecasting
   - "Best time to buy" recommendations
   - Anomaly prediction

---

## 7. Infrastructure Improvements

### Current Architecture Issues

| Issue | Impact | Recommendation |
|-------|--------|----------------|
| Single-region deployment | Latency for distant users | Multi-region setup |
| No CDN for static assets | Slow page loads | CloudFront/Cloudflare |
| Manual VM management | Operational overhead | Consider managed K8s |
| No staging environment | Risky deployments | Add staging tier |

### Recommended Infrastructure Upgrades

#### Phase 1: Launch (Current)
```
Vercel (App) → Supabase (DB) → Upstash (Redis)
     ↓
Compute Engine VM (Workers + Prometheus)
```
**Cost:** $15-50/month

#### Phase 2: Scale (100-500 users)
```
Cloud Run (App) → Cloud SQL (DB) → Memorystore (Redis)
     ↓
GKE Autopilot (Workers) → Grafana Cloud
```
**Cost:** $100-300/month

#### Phase 3: Enterprise (1000+ users)
```
Multi-region Cloud Run → Cloud Spanner (DB)
     ↓
GKE Multi-cluster (Workers) → Full Observability Stack
```
**Cost:** $500-2000/month

---

## 8. Implementation Effort Estimates

### Sprint 1: Pre-Launch Hardening (Week 1)

| Task | Days | Dependencies |
|------|------|--------------|
| Deal verifier implementation | 2 | None |
| Stripe integration testing | 1 | Test accounts |
| Critical path tests | 3 | Test framework |
| Monitoring setup | 2 | Prometheus/Grafana |
| Security checklist | 1 | None |

**Total:** 9 developer-days

### Sprint 2: Reliability & Monitoring (Week 2)

| Task | Days | Dependencies |
|------|------|--------------|
| Scraping improvements | 3 | None |
| Circuit breakers | 2 | None |
| Structured logging | 2 | None |
| Alert system | 1 | Monitoring |
| Documentation | 2 | None |

**Total:** 10 developer-days

### Sprint 3: Post-Launch Iteration (Week 3-4)

| Task | Days | Dependencies |
|------|------|--------------|
| AI provider expansion | 2 | Gemini API access |
| Historical deal browser | 3 | None |
| Performance optimization | 3 | Metrics data |
| Retailer expansion | 5 | None |
| Test coverage expansion | 5 | None |

**Total:** 18 developer-days

---

## Appendix A: Files Requiring Immediate Attention

| File | Issue | Action Required |
|------|-------|-----------------|
| `src/workers/deal-verifier.ts` | TODO at line 77 | Implement re-scrape logic |
| `src/app/api/webhooks/stripe/route.ts` | Untested | Add integration tests |
| `src/lib/monitoring/metrics.ts` | Basic implementation | Add Prometheus push |
| `src/lib/monitoring/alerts.ts` | Discord only | Add email alerts |

## Appendix B: External Dependencies Risk Assessment

| Dependency | Risk Level | Mitigation |
|------------|------------|------------|
| Firecrawl | Medium | Jina fallback implemented |
| OpenRouter/DeepSeek | Medium | Add Gemini, rule-based fallback |
| Clerk | Low | Well-established provider |
| Stripe | Low | Industry standard |
| Upstash Redis | Low | Can migrate to self-hosted |
| Supabase | Medium | Can migrate to Cloud SQL |

## Appendix C: Cost Projections

| User Count | Infrastructure | API Costs | Total |
|------------|----------------|-----------|-------|
| 10-50 | $15-50 | $20-50 | **$35-100/mo** |
| 50-200 | $50-100 | $50-100 | **$100-200/mo** |
| 200-500 | $100-200 | $100-200 | **$200-400/mo** |
| 500-1000 | $200-500 | $200-400 | **$400-900/mo** |

---

## Conclusion

PriceHawk is architecturally sound and feature-complete for beta operations. The primary focus for PRD development should be:

1. **Immediate (P0):** Complete the deal verifier, test billing, add monitoring
2. **Short-term (P1):** Improve scraping reliability, add circuit breakers
3. **Medium-term (P2):** Expand features, improve test coverage
4. **Long-term (P3):** Mobile apps, international expansion, ML features

The platform is well-positioned for a successful February 2026 launch with the identified improvements implemented.

---

*Document generated by automated repository analysis*
