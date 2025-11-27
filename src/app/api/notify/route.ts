import { NextRequest, NextResponse } from 'next/server';
import { notificationManager, NotificationManager } from '@/lib/notifications/manager';
import { ValidatedGlitchSchema } from '@/types';
import { z } from 'zod';

// Request validation schema
const NotifyRequestSchema = z.object({
  glitch: ValidatedGlitchSchema,
  channels: z.array(z.enum(['facebook', 'discord', 'sms'])).optional(),
  priority_only: z.boolean().optional().default(false),
});

/**
 * POST /api/notify
 * Send notifications for a confirmed pricing glitch
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const parseResult = NotifyRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request',
          details: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { glitch, channels, priority_only } = parseResult.data;

    // Create manager with specified channels or use default
    const manager = channels 
      ? new NotificationManager(channels)
      : notificationManager;

    // Send notifications
    let results;
    if (priority_only) {
      // Only send to priority channel (Facebook)
      const result = await manager.notifyPriority(glitch);
      results = new Map([['facebook', result]]);
    } else {
      // Send to all enabled channels
      results = await manager.notifyAll(glitch);
    }

    // Convert Map to plain object for JSON response
    const resultsObject: Record<string, unknown> = {};
    let successCount = 0;
    let failCount = 0;

    results.forEach((result, channel) => {
      resultsObject[channel] = result;
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    });

    return NextResponse.json({
      success: successCount > 0,
      summary: {
        total: results.size,
        successful: successCount,
        failed: failCount,
      },
      results: resultsObject,
    });
  } catch (error) {
    console.error('Notify API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notify
 * Health check and list available channels
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'notify',
    timestamp: new Date().toISOString(),
    channels: {
      facebook: {
        enabled: !!process.env.FACEBOOK_PAGE_ID && !!process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
        priority: 1,
      },
      discord: {
        enabled: !!process.env.DISCORD_WEBHOOK_URL,
        priority: 2,
      },
      sms: {
        enabled: !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN,
        priority: 3,
      },
    },
  });
}
