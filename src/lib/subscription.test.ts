import { expect, test, describe, vi } from 'vitest';
import { hasAccess, getTierLevel, SUBSCRIPTION_TIERS } from './subscription';

// Mock DB because subscription.ts imports it? 
// Actually subscription.ts imports db but these functions are pure.
// If importing implementation imports db, execution might fail if db connect fails in test env?
// Let's hope it's fine or mock it.

vi.mock('@/db', () => ({
  db: {}
}));

vi.mock('./stripe', () => ({
  stripe: {}
}));

describe('Subscription Logic', () => {
  test('hasAccess checks tier levels correctly', () => {
    expect(hasAccess('starter', 'free')).toBe(true);
    expect(hasAccess('starter', 'starter')).toBe(true);
    expect(hasAccess('starter', 'pro')).toBe(false);
    expect(hasAccess('elite', 'pro')).toBe(true);
  });

  test('getTierLevel returns correct values', () => {
     expect(getTierLevel('free')).toBe(0);
     expect(getTierLevel('starter')).toBe(1);
     expect(getTierLevel('pro')).toBe(2);
     expect(getTierLevel('elite')).toBe(3);
  });
  
  test('Tiers have correct notification delays', () => {
      expect(SUBSCRIPTION_TIERS.free.limits.notificationDelay).toBe(72 * 60 * 60 * 1000);
      expect(SUBSCRIPTION_TIERS.starter.limits.notificationDelay).toBe(24 * 60 * 60 * 1000);
      expect(SUBSCRIPTION_TIERS.pro.limits.notificationDelay).toBe(0);
  });
});
