import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createCheckoutSession, SUBSCRIPTION_TIERS, SubscriptionTier } from '@/lib/subscription';
import { db } from '@/db';

type BillingCycle = 'monthly' | 'annual';

/**
 * POST /api/checkout
 * Create a Stripe Checkout session for subscription purchase
 * Supports both monthly and annual billing cycles
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tier, billingCycle = 'annual' } = await req.json() as {
      tier: string;
      billingCycle?: BillingCycle;
    };

    // Validate tier
    if (!tier || !['starter', 'pro', 'elite'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid subscription tier' }, { status: 400 });
    }

    // Validate billing cycle
    if (!['monthly', 'annual'].includes(billingCycle)) {
      return NextResponse.json({ error: 'Invalid billing cycle' }, { status: 400 });
    }

    const tierConfig = SUBSCRIPTION_TIERS[tier as SubscriptionTier];

    // Select price ID based on billing cycle
    const priceId = billingCycle === 'annual'
      ? tierConfig?.priceIdAnnual
      : tierConfig?.priceId;

    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price not configured for ${tier} (${billingCycle})` },
        { status: 500 }
      );
    }

    // Upsert user record from the current Clerk session (no extra network call)
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress;
    if (!email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    const user = await db.user.upsert({
      where: { clerkId },
      create: { clerkId, email },
      update: { email },
    });

    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const session = await createCheckoutSession(
      user.id,
      priceId,
      `${baseUrl}/dashboard?checkout=success&tier=${tier}&billing=${billingCycle}`,
      `${baseUrl}/pricing?checkout=canceled`
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/checkout
 * Get available subscription tiers with pricing info
 */
export async function GET() {
  const tiers = Object.entries(SUBSCRIPTION_TIERS)
    .filter(([key]) => key !== 'free')
    .map(([key, config]) => ({
      id: key,
      name: config.name,
      monthlyPrice: config.monthlyPrice,
      annualPrice: config.annualPrice,
      features: config.features,
      popular: 'popular' in config ? config.popular : false,
    }));

  return NextResponse.json({ tiers });
}
