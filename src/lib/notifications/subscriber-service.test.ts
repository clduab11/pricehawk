import { expect, test, describe, vi, beforeEach } from 'vitest';
import { SubscriberNotificationService } from './subscriber-service';
import { ValidatedGlitch, Product } from '@/types';
import { db } from '@/db';
import { SMSProvider } from './providers/sms';
import { EmailProvider } from './providers/email';
import { setKey, getKey } from '@/lib/clients/redis';

// Mocks
vi.mock('@/db', () => ({
  db: {
    user: {
      findMany: vi.fn(),
    },
  },
}));

const { mockSmsSend, mockEmailSend, mockTelegramSend, mockWhatsAppSend } = vi.hoisted(() => {
  return {
    mockSmsSend: vi.fn(),
    mockEmailSend: vi.fn(),
    mockTelegramSend: vi.fn(),
    mockWhatsAppSend: vi.fn(),
  };
});

vi.mock('@/lib/stripe', () => ({
  stripe: {}
}));

vi.mock('./providers/sms', () => ({
  SMSProvider: class {
    send = mockSmsSend;
  }
}));

vi.mock('./providers/email', () => ({
  EmailProvider: class {
    send = mockEmailSend;
  }
}));

vi.mock('./providers/telegram', () => ({
  TelegramProvider: class {
    send = mockTelegramSend;
  }
}));

vi.mock('./providers/whatsapp', () => ({
  WhatsAppProvider: class {
    send = mockWhatsAppSend;
  }
}));

vi.mock('@/lib/clients/redis', () => ({
  getKey: vi.fn(),
  setKey: vi.fn(),
}));

// Mock Subscription Helper
vi.mock('@/lib/subscription', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual as any,
        hasAccess: (tier: string, feature: string) => {
            if (feature === 'pro' && (tier === 'pro' || tier === 'elite')) return true;
            return false;
        }
    };
});

describe('SubscriberNotificationService', () => {
  let service: SubscriberNotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SubscriberNotificationService();
    mockSmsSend.mockResolvedValue({ success: true, channel: 'sms' });
    mockEmailSend.mockResolvedValue({ success: true, channel: 'email' });
    mockTelegramSend.mockResolvedValue({ success: true, channel: 'telegram' });
    mockWhatsAppSend.mockResolvedValue({ success: true, channel: 'whatsapp' });
  });

  const mockGlitch: ValidatedGlitch = {
    id: 'glitch-1',
    productId: 'prod-1',
    anomalyId: 'anomaly-1',
    isGlitch: true,
    confidence: 90,
    reasoning: 'Price dropped 90%',
    glitchType: 'clearance',
    profitMargin: 90,
    validatedAt: new Date().toISOString(),
    product: {
      id: 'prod-1',
      title: 'Test Product',
      price: 10,
      originalPrice: 100,
      retailer: 'TestStore',
      url: 'http://test.com',
      scrapedAt: new Date().toISOString(),
    } as Product,
  };

  test('should send SMS to Pro users with phone number', async () => {
    (db.user.findMany as any).mockResolvedValue([
      {
        id: 'user-pro',
        email: 'pro@test.com',
        phoneNumber: '+1234567890',
        subscription: { tier: 'pro', status: 'active' },
        preferences: { enableSMS: true, enableEmail: false, categories: [], retailers: [] },
      },
    ]);

    await service.notifyEligibleSubscribers(mockGlitch);

    expect(mockSmsSend).toHaveBeenCalledWith(mockGlitch, '+1234567890');
    expect(setKey).toHaveBeenCalled(); // Dedup key set
  });

  test('should NOT send SMS if user has no phone number', async () => {
    (db.user.findMany as any).mockResolvedValue([
      {
        id: 'user-pro-no-phone',
        email: 'pro-nophone@test.com',
        phoneNumber: null,
        subscription: { tier: 'pro', status: 'active' },
        preferences: { enableSMS: true, enableEmail: false, categories: [], retailers: [] },
      },
    ]);

    await service.notifyEligibleSubscribers(mockGlitch);

    expect(mockSmsSend).not.toHaveBeenCalled();
  });

  test('should NOT send SMS to Free/Starter users even if enabled', async () => {
    (db.user.findMany as any).mockResolvedValue([
      {
        id: 'user-starter',
        email: 'starter@test.com',
        phoneNumber: '+1234567890',
        subscription: { tier: 'starter', status: 'active' },
        preferences: { enableSMS: true, enableEmail: false, categories: [], retailers: [] },
      },
    ]);

    await service.notifyEligibleSubscribers(mockGlitch);

    expect(mockSmsSend).not.toHaveBeenCalled();
  });

  test('should respect user preferences (min profit)', async () => {
       (db.user.findMany as any).mockResolvedValue([
      {
        id: 'user-picky',
        email: 'picky@test.com',
        phoneNumber: '+1234567890',
        subscription: { tier: 'pro', status: 'active' },
        preferences: { 
            enableSMS: true, 
            minProfitMargin: 95, // Glitch is 90
            categories: [], 
            retailers: [] 
        },
      },
    ]);

    await service.notifyEligibleSubscribers(mockGlitch);

    expect(mockSmsSend).not.toHaveBeenCalled();
  });

  test('should send Telegram to Pro users with chatId', async () => {
    (db.user.findMany as any).mockResolvedValue([
      {
        id: 'user-tele',
        email: 'tele@test.com',
        phoneNumber: null,
        subscription: { tier: 'pro', status: 'active' },
        preferences: { 
            enableTelegram: true, 
            telegramChatId: '12345',
            categories: [], 
            retailers: [] 
        },
      },
    ]);

    await service.notifyEligibleSubscribers(mockGlitch);

    expect(mockTelegramSend).toHaveBeenCalledWith(mockGlitch, '12345');
    expect(setKey).toHaveBeenCalled();
  });

  test('should NOT send Telegram to Starter users even if enabled', async () => {
    (db.user.findMany as any).mockResolvedValue([
      {
        id: 'user-tele-starter',
        email: 'tele@test.com',
        phoneNumber: null,
        subscription: { tier: 'starter', status: 'active' },
        preferences: { 
            enableTelegram: true, 
            telegramChatId: '12345',
            categories: [], 
            retailers: [] 
        },
      },
    ]);

    await service.notifyEligibleSubscribers(mockGlitch);

    expect(mockTelegramSend).not.toHaveBeenCalled();
  });

  test('should send WhatsApp to Pro users with phone number', async () => {
    (db.user.findMany as any).mockResolvedValue([
      {
        id: 'user-wa',
        email: 'wa@test.com',
        phoneNumber: '+1234567890',
        subscription: { tier: 'pro', status: 'active' },
        preferences: { 
            enableWhatsApp: true, 
            categories: [], 
            retailers: [] 
        },
      },
    ]);

    await service.notifyEligibleSubscribers(mockGlitch);

    expect(mockWhatsAppSend).toHaveBeenCalledWith(mockGlitch, '+1234567890');
    expect(setKey).toHaveBeenCalled();
  });

  test('should NOT send WhatsApp if user has no phone number', async () => {
    (db.user.findMany as any).mockResolvedValue([
      {
        id: 'user-wa-nophone',
        email: 'wa@test.com',
        phoneNumber: null,
        subscription: { tier: 'pro', status: 'active' },
        preferences: { 
            enableWhatsApp: true, 
            categories: [], 
            retailers: [] 
        },
      },
    ]);

    await service.notifyEligibleSubscribers(mockGlitch);

    expect(mockWhatsAppSend).not.toHaveBeenCalled();
  });
});
