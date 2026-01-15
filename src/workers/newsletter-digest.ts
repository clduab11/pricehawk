import { db } from '../db/index';
import { BeehiivProvider } from '../lib/notifications/beehiiv';
import { fileURLToPath } from 'url';

const beehiiv = new BeehiivProvider();

export async function generateDailyDigest() {
    console.log("Generating daily newsletter digest...");
    
    // Get deals from last 24h
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const deals = await db.validatedGlitch.findMany({
        where: {
            isGlitch: true,
            validatedAt: { gte: yesterday },
            confidence: { gt: 70 }
        },
        orderBy: { profitMargin: 'desc' },
        take: 10,
        include: { product: true }
    });

    if (deals.length === 0) {
        console.log("No deals found for digest, skipping.");
        return;
    }

    // Compile HTML
    let html = `<h1>🦅 PriceHawk Daily Digest</h1>`;
    html += `<p>Here are the top ${deals.length} price glitches found in the last 24 hours.</p><hr/>`;
    
    html += `<ul>`;
    for (const deal of deals) {
        const price = Number(deal.product.price).toFixed(2);
        const orig = deal.product.originalPrice ? Number(deal.product.originalPrice).toFixed(2) : 'N/A';
        html += `<li style="margin-bottom: 20px;">
            <a href="${deal.product.url}" style="font-size: 18px; font-weight: bold;">${deal.product.title}</a><br/>
            💰 <b>$${price}</b> (Was $${orig}) <br/>
            <i>Confidence: ${deal.confidence}%</i> | <a href="${process.env.NEXT_PUBLIC_APP_URL || '#'}">View on Dashboard</a>
        </li>`;
    }
    html += `</ul>`;
    html += `<hr/><p>See you tomorrow! 👋</p>`;

    // Send to Beehiiv
    const postId = await beehiiv.createPublication({
        title: `PriceHawk Daily Digest - ${now.toLocaleDateString()}`,
        content: html,
        audience: 'all'
    });

    if (postId) {
        console.log(`Newsletter post created in Beehiiv: ${postId}`);
        await db.newsletterIssue.create({
            data: {
                beehiivPostId: postId,
                title: `PriceHawk Daily Digest - ${now.toLocaleDateString()}`,
                dealCount: deals.length,
                audienceType: 'all',
                scheduledFor: now,
                status: 'draft' // Beehiiv creates as draft by default usually unless scheduled
            }
        });
    } else {
        console.log("Failed to create Beehiiv post.");
    }
}

// Standalone execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    generateDailyDigest()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}
