import { NextResponse } from 'next/server';
import { db } from '@/db';
import { getKey, setKey } from '@/lib/clients/redis';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 * Health check endpoint for monitoring and load balancers
 * 
 * Checks:
 * - Application status
 * - Database connectivity
 * - Redis connectivity
 */
export async function GET() {
  const checks: Record<string, string> = {
    app: 'running',
    database: 'unknown',
    redis: 'unknown',
  };

  let isHealthy = true;

  try {
    // Check database connection
    await db.$queryRaw`SELECT 1`;
    checks.database = 'connected';
  } catch (error) {
    checks.database = 'disconnected';
    isHealthy = false;
    console.error('Health check: Database connection failed', error);
  }

  try {
    // Check Redis connection with a simple set/get
    const testKey = 'health:check';
    await setKey(testKey, Date.now().toString(), 60);
    const result = await getKey(testKey);
    if (result) {
      checks.redis = 'connected';
    } else {
      checks.redis = 'degraded';
    }
  } catch (error) {
    checks.redis = 'disconnected';
    isHealthy = false;
    console.error('Health check: Redis connection failed', error);
  }

  const response = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    services: checks,
  };

  if (isHealthy) {
    return NextResponse.json(response);
  } else {
    return NextResponse.json(response, { status: 503 });
  }
}
