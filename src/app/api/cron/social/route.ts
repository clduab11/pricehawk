import { NextRequest, NextResponse } from 'next/server';
import { socialQueue } from '@/workers/social-poster';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new NextResponse('Unauthorized', { status: 401 });
  // }

  console.log('[Cron] Triggering Social Poster');
  
  try {
    await socialQueue.add('hourly-digest', { jobType: 'hourly-digest' });
    return NextResponse.json({ success: true, message: 'Social exposure cycle triggered' });
  } catch (error: any) {
    console.error('[Cron] Failed to trigger social poster:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
