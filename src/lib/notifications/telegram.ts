import { Telegraf } from 'telegraf';

export class TelegramProvider {
  private bot: Telegraf | null = null;
  private channelId: string | undefined;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.channelId = process.env.TELEGRAM_CHANNEL_ID;

    if (token) {
      this.bot = new Telegraf(token);
    } else {
        console.warn("Telegram Bot Token missing.");
    }
  }

  async broadcastToChannel(message: string, imageUrl?: string): Promise<void> {
    if (!this.bot || !this.channelId) {
        console.warn("Cannot broadcast: Bot token or Channel ID missing.");
        return;
    }

    try {
        if (imageUrl) {
            await this.bot.telegram.sendPhoto(this.channelId, imageUrl, { caption: message, parse_mode: 'HTML' });
        } else {
            await this.bot.telegram.sendMessage(this.channelId, message, { parse_mode: 'HTML' });
        }
    } catch (error) {
        console.error("Telegram broadcast failed:", error);
    }
  }

  async sendToUser(chatId: string, message: string, imageUrl?: string): Promise<void> {
    if (!this.bot) return;

    try {
        if (imageUrl) {
            await this.bot.telegram.sendPhoto(chatId, imageUrl, { caption: message, parse_mode: 'HTML' });
        } else {
            await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
        }
    } catch (error) {
        console.error(`Telegram send to ${chatId} failed:`, error);
    }
  }
}
