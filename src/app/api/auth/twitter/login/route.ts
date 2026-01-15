import { NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';

export async function GET() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Twitter credentials missing' }, { status: 500 });
  }

  const client = new TwitterApi({ clientId, clientSecret });

  // Generate the auth link
  // 'tweet.write' and 'tweet.read' are essential for reading/writing tweets
  // 'users.read' to get user ID
  // 'offline.access' to get refresh token
  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
    process.env.NEXT_PUBLIC_APP_URL + '/api/auth/twitter/callback',
    { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] }
  );

  const response = NextResponse.redirect(url);
  
  // Store verifier and state in cookies
  response.cookies.set('twitter_code_verifier', codeVerifier, { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/' });
  response.cookies.set('twitter_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/' });

  return response;
}
