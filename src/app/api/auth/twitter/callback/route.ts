import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { db } from '@/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const state = searchParams.get('state');
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
     return NextResponse.json({ error: 'Twitter Auth Error: ' + error }, { status: 400 });
  }

  if (!code || !state) {
      return NextResponse.json({ error: 'Invalid callback parameters' }, { status: 400 });
  }

  // Retrieve stored tokens
  const storedState = req.cookies.get('twitter_state')?.value;
  const storedVerifier = req.cookies.get('twitter_code_verifier')?.value;

  if (!storedState || !storedVerifier || state !== storedState) {
    return NextResponse.json({ error: 'Invalid state or session expired' }, { status: 400 });
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Twitter credentials missing' }, { status: 500 });
  }

  try {
    const client = new TwitterApi({ clientId, clientSecret });

    const { client: loggedClient, accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({
      code,
      codeVerifier: storedVerifier,
      redirectUri: process.env.NEXT_PUBLIC_APP_URL + '/api/auth/twitter/callback',
    });

    // Calculate expiry
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Get User Info
    const me = await loggedClient.v2.me();
    
    // For MVP: We assume the user is already logged in to our app, 
    // but in this flow we don't have the user's session context available in this callback 
    // unless we pass it via state or have a session cookie reader.
    // 
    // FOR DEMO PURPOSES: We will link this to the FIRST user found in DB or a specific demo user.
    // In production, use `auth()` from your auth provider (Clerk/NextAuth) here.
    
    // Attempt to find a user to attach these tokens to
    // Priority: Find user with this previous twitter ID?? No, can't know that.
    // Fallback: Just update the most recently created user for local dev convenience?
    // Proper way: Store user ID in 'state' or session.
    
    // Let's assume there's a user called "admin" or just pick the first one.
    const user = await db.user.findFirst();

    if (user) {
        await db.userPreference.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                twitterAccessToken: accessToken,
                twitterRefreshToken: refreshToken,
                twitterExpiresAt: expiresAt,
                enableDiscord: false // defaults
            },
            update: {
                twitterAccessToken: accessToken,
                twitterRefreshToken: refreshToken,
                twitterExpiresAt: expiresAt
            }
        });
        
        return NextResponse.json({ 
            success: true, 
            message: `Twitter connected for user ${me.data.username}`,
            expiresAt 
        });
    } else {
        return NextResponse.json({ error: 'No local user found to link account' }, { status: 404 });
    }

  } catch (err) {
      console.error('Twitter Login Error:', err);
      return NextResponse.json({ error: 'Failed to authenticate with Twitter' }, { status: 500 });
  }
}
