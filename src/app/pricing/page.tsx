'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';

// 2026 Market-Competitive Pricing (aligned with PricingErrors.com, BrickSeek, flight deals industry)
const TIERS = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      'Weekly email digest',
      '5 deals per week',
      'Community Discord access',
      '72-hour delay on all deals',
    ],
    color: 'bg-gray-900/50 border-gray-700/50',
    buttonStyle: 'bg-white/10 hover:bg-white/20 text-white',
    buttonText: 'Get Started Free',
  },
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 7,
    annualPrice: 59, // ~$4.92/mo, 30% savings
    features: [
      'Daily deal notifications',
      'Unlimited deals (24hr delay)',
      'Discord + Email alerts',
      'Basic category filters',
      'Price history (30 days)',
    ],
    color: 'bg-gray-800/50 border-gray-700',
    buttonStyle: 'bg-white/10 hover:bg-white/20 text-white',
  },
  {
    id: 'pro',
    name: 'Pro',
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
    color: 'bg-gradient-to-b from-blue-900/50 to-blue-950/50 border-blue-500 ring-2 ring-blue-500/50',
    buttonStyle: 'bg-blue-600 hover:bg-blue-700 text-white',
    popular: true,
  },
  {
    id: 'elite',
    name: 'Elite',
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
    color: 'bg-gradient-to-b from-amber-900/30 to-gray-900/50 border-amber-500/50',
    buttonStyle: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white',
  },
];

// Launch period configuration (must match server-side)
const LAUNCH_DATE = new Date(process.env.NEXT_PUBLIC_LAUNCH_DATE || '2026-02-01T00:00:00Z');
const LAUNCH_PROMO_DAYS = 60;

function isLaunchPeriod(): boolean {
  const now = new Date();
  const launchEnd = new Date(LAUNCH_DATE);
  launchEnd.setDate(launchEnd.getDate() + LAUNCH_PROMO_DAYS);
  return now >= LAUNCH_DATE && now < launchEnd;
}

function getLaunchDaysRemaining(): number {
  if (!isLaunchPeriod()) return 0;
  const now = new Date();
  const launchEnd = new Date(LAUNCH_DATE);
  launchEnd.setDate(launchEnd.getDate() + LAUNCH_PROMO_DAYS);
  return Math.ceil((launchEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function PricingPage() {
  const { isSignedIn } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [launchDays, setLaunchDays] = useState(0);
  const [inLaunchPeriod, setInLaunchPeriod] = useState(false);

  useEffect(() => {
    setInLaunchPeriod(isLaunchPeriod());
    setLaunchDays(getLaunchDaysRemaining());
  }, []);

  const handleSubscribe = async (tierId: string) => {
    if (tierId === 'free') {
      window.location.href = isSignedIn ? '/dashboard' : '/sign-up';
      return;
    }

    if (!isSignedIn) {
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent('/pricing')}`;
      return;
    }

    setLoading(tierId);
    setError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tierId, billingCycle }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(null);
    }
  };

  const getDisplayPrice = (tier: typeof TIERS[number]) => {
    if (tier.monthlyPrice === 0) return '$0';
    if (billingCycle === 'annual') {
      const monthlyEquivalent = (tier.annualPrice / 12).toFixed(0);
      return `$${monthlyEquivalent}`;
    }
    return `$${tier.monthlyPrice}`;
  };

  const getAnnualSavings = (tier: typeof TIERS[number]) => {
    if (tier.monthlyPrice === 0) return 0;
    const annualIfMonthly = tier.monthlyPrice * 12;
    return Math.round(((annualIfMonthly - tier.annualPrice) / annualIfMonthly) * 100);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="px-6 h-16 flex items-center justify-between border-b border-white/10">
        <Link href="/" className="font-bold text-xl">🦅 pricehawk</Link>
        <div className="flex gap-4">
          {isSignedIn ? (
            <Link href="/dashboard" className="px-4 py-2 bg-white text-black rounded-full font-medium hover:bg-gray-200">
              Dashboard
            </Link>
          ) : (
            <Link href="/sign-in" className="px-4 py-2 bg-white text-black rounded-full font-medium hover:bg-gray-200">
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Launch Period Banner */}
      {inLaunchPeriod && (
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 py-3 px-6 text-center">
          <p className="font-bold text-white">
            🚀 LAUNCH SPECIAL: All users get Pro features FREE for {launchDays} more days!
            <span className="ml-2 text-green-200 font-normal">No credit card required.</span>
          </p>
        </div>
      )}

      {/* Pricing Content */}
      <div className="p-6 md:p-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Choose Your Weapon
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
            One good deal pays for the entire year. Invest in the tools that pay for themselves.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center gap-4 mb-2">
            <span className={`text-sm ${billingCycle === 'monthly' ? 'text-white' : 'text-gray-500'}`}>Monthly</span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
              className={`relative w-14 h-7 rounded-full transition-colors ${billingCycle === 'annual' ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${billingCycle === 'annual' ? 'translate-x-7' : 'translate-x-0.5'}`}
              />
            </button>
            <span className={`text-sm ${billingCycle === 'annual' ? 'text-white' : 'text-gray-500'}`}>
              Annual <span className="text-green-400 font-bold">Save 30%</span>
            </span>
          </div>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-red-900/50 border border-red-500 rounded-xl text-center">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        <div className="grid md:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-3xl p-6 flex flex-col relative border ${tier.color} backdrop-blur-sm transition-transform hover:scale-[1.02]`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-lg shadow-blue-500/30">
                  Most Popular
                </div>
              )}

              <h3 className="text-lg font-bold text-gray-300 mb-2">{tier.name}</h3>

              <div className="mb-1">
                <span className="text-4xl font-bold">{getDisplayPrice(tier)}</span>
                <span className="text-gray-500 font-normal">/mo</span>
              </div>

              {billingCycle === 'annual' && tier.monthlyPrice > 0 && (
                <div className="text-sm text-gray-400 mb-4">
                  <span className="text-green-400">${tier.annualPrice}/yr</span>
                  <span className="ml-2 text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">
                    Save {getAnnualSavings(tier)}%
                  </span>
                </div>
              )}
              {(billingCycle === 'monthly' || tier.monthlyPrice === 0) && (
                <div className="text-sm text-gray-400 mb-4">
                  {tier.monthlyPrice === 0 ? 'Forever free' : `$${tier.monthlyPrice * 12}/yr if monthly`}
                </div>
              )}

              <ul className="space-y-3 mb-6 flex-1 text-sm">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-2 items-start">
                    <span className="text-green-400 mt-0.5 text-xs">✓</span>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(tier.id)}
                disabled={loading === tier.id}
                className={`w-full py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm ${tier.buttonStyle}`}
              >
                {loading === tier.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  tier.buttonText || 'Subscribe Now'
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Value Proposition */}
        <div className="max-w-4xl mx-auto mt-16 p-8 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-3xl border border-blue-500/20">
          <h3 className="text-2xl font-bold text-center mb-6">💰 The Math is Simple</h3>
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-green-400">$99/yr</div>
              <div className="text-gray-400">Pro Annual Cost</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-400">1 Deal</div>
              <div className="text-gray-400">Pays for itself</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-400">∞ Savings</div>
              <div className="text-gray-400">After that</div>
            </div>
          </div>
          <p className="text-center text-gray-400 mt-6">
            Our average user finds deals worth $500+ in savings within the first month.
            The subscription pays for itself many times over.
          </p>
        </div>

        {/* Money-back guarantee */}
        <div className="text-center mt-12 text-gray-500">
          <p>💰 7-day money-back guarantee • Cancel anytime • No hidden fees</p>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mt-24">
          <h2 className="text-2xl font-bold text-center mb-12">Frequently Asked Questions</h2>

          <div className="space-y-6">
            <div className="p-6 bg-gray-900/50 rounded-xl border border-white/10">
              <h3 className="font-bold mb-2">How fast are the notifications?</h3>
              <p className="text-gray-400">
                Pro and Elite members receive alerts within 5 minutes of detection. Starter gets 24-hour delay, Free gets 72-hour delay.
              </p>
            </div>

            <div className="p-6 bg-gray-900/50 rounded-xl border border-white/10">
              <h3 className="font-bold mb-2">What retailers do you monitor?</h3>
              <p className="text-gray-400">
                We monitor 100+ retailers including Amazon, Walmart, Target, Best Buy, Costco, Home Depot, Lowe&apos;s, and many more.
              </p>
            </div>

            <div className="p-6 bg-gray-900/50 rounded-xl border border-white/10">
              <h3 className="font-bold mb-2">Can I cancel anytime?</h3>
              <p className="text-gray-400">
                Yes! Cancel anytime from your dashboard. You&apos;ll keep access until your billing period ends.
              </p>
            </div>

            <div className="p-6 bg-gray-900/50 rounded-xl border border-white/10">
              <h3 className="font-bold mb-2">Why annual pricing?</h3>
              <p className="text-gray-400">
                Annual subscribers save 28-31% compared to monthly. Plus, pricing error hunting is a long game—you want to be ready when that $2000 TV goes on sale for $20.
              </p>
            </div>

            <div className="p-6 bg-gray-900/50 rounded-xl border border-white/10">
              <h3 className="font-bold mb-2">What&apos;s the launch special?</h3>
              <p className="text-gray-400">
                During our 60-day launch period, ALL users get Pro-tier features for free. No credit card required. After the launch period, you&apos;ll need to subscribe to keep real-time alerts.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/10 text-center text-gray-500">
        © {new Date().getFullYear()} pricehawk. All rights reserved.
      </footer>
    </div>
  );
}
