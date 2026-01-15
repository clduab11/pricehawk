import { Telegraf } from 'telegraf';
import { db } from '../db/index';
import { AffiliateService } from '../lib/services/affiliate';
import { fileURLToPath } from 'url';

const token = process.env.TELEGRAM_BOT_TOKEN;

async function startBot() {
    if (!token) {
        console.error("TELEGRAM_BOT_TOKEN is missing. Bot cannot start.");
        return;
    }

    const bot = new Telegraf(token);

    bot.start(async (ctx) => {
        const welcomeMsg = `Welcome to PriceHawk Bot! 🦅\n\n` +
                           `I will send you alerts about price glitches.\n\n` +
                           `Your Chat ID is: <code>${ctx.chat.id}</code>\n` +
                           `(Use this to subscribe in your dashboard settings)`;
        
        await ctx.reply(welcomeMsg, { parse_mode: 'HTML' });
    });

    bot.command('deals', async (ctx) => {
        try {
            // Fetch latest glitches
            const latestGlitches = await db.validatedGlitch.findMany({
                where: { isGlitch: true },
                orderBy: { validatedAt: 'desc' },
                take: 5,
                include: { product: true }
            });

            if (latestGlitches.length === 0) {
                await ctx.reply("No recent glitches found.");
                return;
            }

            for (const glitch of latestGlitches) {
                const product = glitch.product;
                await ctx.reply(
                    `<b>${product.title}</b>\n` +
                    `💰 $${Number(product.price).toFixed(2)}\n` +
                    `🔗 ${AffiliateService.transformUrl(product.url, product.retailer)}`, 
                    { parse_mode: 'HTML' }
                );
            }
        } catch (error) {
            console.error("Error fetching deals:", error);
            await ctx.reply("Sorry, I couldn't fetch deals at the moment.");
        }
    });

    bot.launch().then(() => {
        console.log('Telegram Bot started!');
    });

    // Enable graceful stop
    const stopBot = (signal: string) => {
        bot.stop(signal);
        process.exit(0);
    };

    process.once('SIGINT', () => stopBot('SIGINT'));
    process.once('SIGTERM', () => stopBot('SIGTERM'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    startBot();
}
