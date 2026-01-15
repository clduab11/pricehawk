import { NextRequest, NextResponse } from 'next/server';
import { AffiliateTracker } from '@/lib/affiliate/tracker';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { trackingId: string } }) {
  const trackingId = params.trackingId;
  
  if (!trackingId) {
    return new NextResponse('Missing ID', { status: 400 });
  }

  const tracker = new AffiliateTracker();
  const destination = await tracker.resolveLink(trackingId);

  if (destination) {
    return NextResponse.redirect(destination);
  } else {
    return new NextResponse('Link expired or invalid', { status: 404 });
  }
}
