import { NextResponse } from 'next/server';
import { db } from '@/db';
import { Queue } from 'bullmq';

// Stats API for Admin Dashboard

export async function GET() {
  try {
    // 1. Get DB Stats
    const productCount = await db.product.count();
    const glitchCount = await db.validatedGlitch.count();
    const anomalyCount = await db.pricingAnomaly.count();
    
    // 2. Get Queue Stats
    // Assuming queues are named as per convention
    const scrapingQueue = new Queue('scraping-queue', { connection: { 
        host: process.env.REDIS_HOST || 'localhost', 
        port: Number(process.env.REDIS_PORT) || 6379 
    }});
    
    const scrapingJobCounts = await scrapingQueue.getJobCounts();
    
    await scrapingQueue.close();

    return NextResponse.json({
      db: {
        products: productCount,
        glitches: glitchCount,
        anomalies: anomalyCount
      },
      queues: {
        scraping: scrapingJobCounts,
      },
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
