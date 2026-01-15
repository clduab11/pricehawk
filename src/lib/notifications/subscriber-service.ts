
import { db } from '@/db';
import { ValidatedGlitch } from '@/types';
import { EmailProvider } from './providers/email';
import { SUBSCRIPTION_TIERS, SubscriptionTier, hasAccess } from '@/lib/subscription';
import { SMSProvider } from './providers/sms';
import { TelegramProvider } from './providers/telegram';
import { WhatsAppProvider } from './providers/whatsapp';
import { getKey, setKey } from '@/lib/clients/redis';

export class SubscriberNotificationService {
  private emailProvider: EmailProvider;
  private smsProvider: SMSProvider;
  private telegramProvider: TelegramProvider;
  private whatsAppProvider: WhatsAppProvider;

  constructor() {
    this.emailProvider = new EmailProvider();
    this.smsProvider = new SMSProvider();
    this.telegramProvider = new TelegramProvider();
    this.whatsAppProvider = new WhatsAppProvider();
  }

  async notifyEligibleSubscribers(glitch: ValidatedGlitch, targetTiers?: SubscriptionTier[]): Promise<void> {
    const whereClause: any = {
      subscription: {
        status: 'active',
      },
    };

    if (targetTiers && targetTiers.length > 0) {
      whereClause.subscription.tier = { in: targetTiers };
    }

    const subscribers = await db.user.findMany({
      where: whereClause,
      include: {
        subscription: true,
        preferences: true,
      },
    });

    console.log(`Found ${subscribers.length} active subscribers to check for glitch ${glitch.id}`);

    const notifications = [];

    for (const user of subscribers) {
      const tier = (user.subscription?.tier as SubscriptionTier) || 'free';
      const config = SUBSCRIPTION_TIERS[tier];

      // 2. Check Tier Gate (Realtime)
      // We rely on the queue delay to enforce timing. 
      // If this method is called, we assume the timing is correct for these tiers.

      // 3. Check Preferences
      if (!this.matchesPreferences(glitch, user.preferences)) {
        continue;
      }

      // 4. Per-User Deduplication
      const dedupKey = `notify:user:${user.id}:glitch:${glitch.id}`;
      if (await getKey(dedupKey)) {
        continue;
      }

      // 5. Send Notifications based on enabled channels
      // EMAIL
      if (user.preferences?.enableEmail) {
        notifications.push(
          this.emailProvider.send(glitch, user.email)
            .then(async result => {
              if (result.success) {
                console.log(`Email sent to ${user.email}`);
                await setKey(dedupKey, '1', 86400 * 7); // 7 days dedup
              } else {
                console.error(`Failed to send email to ${user.email}: ${result.error}`);
              }
            })
        );
      }

      // SMS (Pro/Elite only)
      if (user.preferences?.enableSMS) {
        if (hasAccess(tier, 'pro')) {
            const phoneNumber = user.phoneNumber;
            if (phoneNumber) {
              notifications.push(
                this.smsProvider.send(glitch, phoneNumber)
                  .then(async result => {
                    if (result.success) {
                        console.log(`SMS sent to ${phoneNumber}`);
                        await setKey(dedupKey, '1', 86400 * 7);
                    } else {
                        console.error(`Failed to send SMS to ${phoneNumber}: ${result.error}`);
                    }
                  })
              );
            } else {
              console.warn(`User ${user.id} wants SMS but has no phone number`);
            }
        } else {
            console.log(`User ${user.id} requested SMS but tier ${tier} does not allow it.`);
        }
      }

      // Telegram (Pro/Elite only)
      if (user.preferences?.enableTelegram) {
         if (hasAccess(tier, 'pro')) {
            const chatId = user.preferences.telegramChatId;
            if (chatId) {
               notifications.push(
                this.telegramProvider.send(glitch, chatId)
                  .then(async result => {
                     if (result.success) {
                        console.log(`Telegram sent to ${chatId}`);
                        await setKey(dedupKey, '1', 86400 * 7);
                     } else {
                        console.error(`Failed to send Telegram to ${chatId}: ${result.error}`);
                     }
                  })
               );
            } else {
               console.warn(`User ${user.id} wants Telegram but has no Chat ID`);
            }
         }
      }

      // WhatsApp (Pro/Elite only)
      if (user.preferences?.enableWhatsApp) {
         if (hasAccess(tier, 'pro')) {
            const phoneNumber = user.phoneNumber;
            if (phoneNumber) {
               notifications.push(
                this.whatsAppProvider.send(glitch, phoneNumber)
                  .then(async result => {
                     if (result.success) {
                        console.log(`WhatsApp sent to ${phoneNumber}`);
                        await setKey(dedupKey, '1', 86400 * 7);
                     } else {
                        console.error(`Failed to send WhatsApp to ${phoneNumber}: ${result.error}`);
                     }
                  })
               );
            } else {
               console.warn(`User ${user.id} wants WhatsApp but has no phone number`);
            }
         }
      }
    }

    await Promise.allSettled(notifications);
  }

  private matchesPreferences(
    glitch: ValidatedGlitch,
    prefs: { 
      categories: string[]; 
      minProfitMargin: number; 
      minPrice: any; // Decimal
      maxPrice: any; // Decimal
      retailers: string[];
    } | null
  ): boolean {
    if (!prefs) return true; // Default to receiving everything if no prefs set? Or nothing? Assuming safe defaults.

    // Minimum Profit Margin
    if (glitch.profitMargin < prefs.minProfitMargin) {
      return false;
    }

    // Category Filter (if specified)
    if (prefs.categories.length > 0 && glitch.product.category) {
      const categoryMatch = prefs.categories.some(c => 
        glitch.product.category?.toLowerCase().includes(c.toLowerCase())
      );
      if (!categoryMatch) return false;
    }

    // Retailer Filter (if specified)
    if (prefs.retailers.length > 0) {
      if (!prefs.retailers.includes(glitch.product.retailer)) {
         return false;
      }
    }

    // Price Range
    const price = Number(glitch.product.price);
    const minPrice = Number(prefs.minPrice || 0);
    const maxPrice = Number(prefs.maxPrice || 10000);

    if (price < minPrice || price > maxPrice) {
      return false;
    }

    return true;
  }
}

export const subscriberNotificationService = new SubscriberNotificationService();
