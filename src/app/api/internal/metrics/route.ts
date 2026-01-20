
import { NextResponse } from 'next/server';
import { metrics } from '@/lib/monitoring/metrics';
import { getDLQStats } from '@/lib/streams/dlq';

export const dynamic = 'force-dynamic';

/**
 * GET /api/internal/metrics
 * 
 * Metrics endpoint for monitoring systems.
 * 
 * Query parameters:
 * - format=prometheus : Returns Prometheus text format
 * - format=json (default) : Returns JSON format
 */
export async function GET(req: Request) {
  // Simple auth check - use a secret header or check for admin session
  const authHeader = req.headers.get('authorization');
  if (process.env.METRICS_SECRET && authHeader !== `Bearer ${process.env.METRICS_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'json';

    if (format === 'prometheus') {
      // Return Prometheus text format
      const prometheusText = await metrics.getPrometheusMetrics();
      return new NextResponse(prometheusText, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        },
      });
    }

    // Default: JSON format
    const [counters, dlqStats] = await Promise.all([
      metrics.getMetrics(),
      getDLQStats()
    ]);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      counters,
      dlq: dlqStats,
    });
  } catch (error) {
    console.error('Metrics endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
