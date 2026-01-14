import Stripe from 'stripe';
import { stripe } from './stripe';
import { db } from '@/db';

// ============================================================================
// Launch Configuration
// ============================================================================

/**
 * Launch date for the 60-day free trial period
 * Set this to your PRD-production launch date
 * During this period, ALL users get Pro-tier access for free
 */
export const LAUNCH_DATE = new Date(process.env.LAUNCH_DATE || '2026-02-01T00:00:00Z');
export const LAUNCH_PROMO_DAYS = 60;

/**
 * Check if we're still in the launch promotion period
 */
export function isLaunchPeriod(): boolean {
  const now = new Date();
  const launchEnd = new Date(LAUNCH_DATE);
  launchEnd.setDate(launchEnd.getDate() + LAUNCH_PROMO_DAYS);
  return now >= LAUNCH_DATE && now < launchEnd;
}

/**
 * Get days remaining in launch period
 */
export function getLaunchDaysRemaining(): number {
  if (!isLaunchPeriod()) return 0;
  const now = new Date();
  const launchEnd = new Date(LAUNCH_DATE);
  launchEnd.setDate(launchEnd.getDate() + LAUNCH_PROMO_DAYS);
  return Math.ceil((launchEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ============================================================================
// Subscription Tier Configuration (2026 Competitive Pricing)
// ============================================================================

/**
 * Pricing Strategy:
 * - Aligned with market: $4-8/mo for basic, $10-15/mo for pro (annual equivalent)
 * - Annual pricing offers ~30% discount (industry standard)
 * - Free tier is generous during launch, restricted after
 * - "One good deal pays for the subscription" value proposition
 */

export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    priceId: null,
    priceIdAnnual: null,
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      'Weekly email digest',
      '5 deals per week',
      'Community Discord access',
      '72-hour delay on all deals',
    ],
    limits: {
      dealsPerWeek: 5,
      realtimeNotifications: false,
      apiAccess: false,
      notificationDelay: 72 * 60 * 60 * 1000, // 72 hours (competitive with free tiers)
      webhooks: false,
    },
  },
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_PRICE_STARTER || null,
    priceIdAnnual: process.env.STRIPE_PRICE_STARTER_ANNUAL || null,
    monthlyPrice: 7,
    annualPrice: 59, // ~$4.92/mo, 30% savings
    features: [
      'Daily deal notifications',
      'Unlimited deals (24hr delay)',
      'Discord + Email alerts',
      'Basic category filters',
      'Price history (30 days)',
    ],
    limits: {
      dealsPerWeek: 999,
      realtimeNotifications: false,
      apiAccess: false,
      notificationDelay: 24 * 60 * 60 * 1000, // 24 hours
      webhooks: false,
    },
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRICE_PRO || null,
    priceIdAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL || null,
    monthlyPrice: 12,
    annualPrice: 99, // ~$8.25/mo, 31% savings
    features: [
      'Real-time instant alerts (<5 min)',
      'All channels (Discord, Telegram, SMS, Email)',
      'Advanced filters (margin, category, retailer)',
      'Price history (90 days)',
      'Mobile push notifications',
      'Profit calculator',
    ],
    limits: {
      dealsPerWeek: 999,
      realtimeNotifications: true,
      apiAccess: false,
      notificationDelay: 0, // Instant
      webhooks: false,
    },
    popular: true,
  },
  elite: {
    name: 'Elite',
    priceId: process.env.STRIPE_PRICE_ELITE || null,
    priceIdAnnual: process.env.STRIPE_PRICE_ELITE_ANNUAL || null,
    monthlyPrice: 29,
    annualPrice: 249, // ~$20.75/mo, 28% savings
    features: [
      'Priority access (first to know)',
      'API access (2500 req/day)',
      'Custom webhooks',
      'Location-based in-store deals',
      'Reseller analytics dashboard',
      'Bulk purchase alerts',
      'Private Discord channel',
      'Direct support line',
    ],
    limits: {
      dealsPerWeek: 999,
      realtimeNotifications: true,
      apiAccess: true,
      apiRequestsPerDay: 2500,
      notificationDelay: 0,
      webhooks: true,
      priorityAccess: true,
    },
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;

// ============================================================================
// Helper Functions
// ============================================================================

export function getTierFromPriceId(priceId: string): SubscriptionTier {
  for (const [tier, config] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (config.priceId === priceId || config.priceIdAnnual === priceId) {
      return tier as SubscriptionTier;
    }
  }
  return 'free';
}

/**
 * Get effective tier for a user, considering launch period
 * During launch, all users get Pro-tier access
 */
export function getEffectiveTier(actualTier: SubscriptionTier): SubscriptionTier {
  if (isLaunchPeriod()) {
    // During launch, everyone gets Pro features at minimum
    return getTierLevel(actualTier) > getTierLevel('pro') ? actualTier : 'pro';
  }
  return actualTier;
}

export function getTierLevel(tier: SubscriptionTier): number {
  const levels: Record<SubscriptionTier, number> = {
    free: 0,
    starter: 1,
    pro: 2,
    elite: 3,
  };
  return levels[tier];
}

export function hasAccess(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return getTierLevel(userTier) >= getTierLevel(requiredTier);
}

// ============================================================================
// Stripe Operations
// ============================================================================

export async function createCheckoutSession(
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: userId,
    metadata: { userId },
    subscription_data: {
      metadata: { userId },
    },
  };

  // Use existing customer if available
  if (user.stripeCustomerId) {
    sessionParams.customer = user.stripeCustomerId;
  } else {
    sessionParams.customer_email = user.email;
  }

  return stripe.checkout.sessions.create(sessionParams);
}

export async function createBillingPortalSession(
  userId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.stripeCustomerId) {
    throw new Error('No billing account found');
  }

  return stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  });
}

export async function cancelSubscription(
  userId: string,
  immediately = false
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (!user?.subscription?.stripeSubscriptionId) {
    throw new Error('No active subscription found');
  }

  if (immediately) {
    await stripe.subscriptions.cancel(user.subscription.stripeSubscriptionId);
  } else {
    await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }
}

export async function getUserSubscriptionTier(userId: string): Promise<SubscriptionTier> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (!user?.subscription || user.subscription.status !== 'active') {
    return 'free';
  }

  return (user.subscription.tier as SubscriptionTier) || 'free';
}
