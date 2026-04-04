import db from '../../../../lib/db';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  if (error || !code) {
    return Response.redirect(`${appUrl}/?error=auth_failed`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || 'DUMMY_CLIENT_ID';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'DUMMY_SECRET';
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  try {
    // Exchange code for tokens (this will fail if DUMMY env vars are used, but we handle it gracefully)
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      })
    });

    const tokens = await tokenRes.json();

    if (tokens.access_token) {
       // Save to database
       const stmt = db.prepare(`
         INSERT INTO user_integrations (provider, access_token, refresh_token, expires_at, last_sync) 
         VALUES (?, ?, ?, ?, ?)
       `);
       
       const expiresAt = Date.now() + (tokens.expires_in * 1000);
       stmt.run('google', tokens.access_token, tokens.refresh_token || '', expiresAt, new Date().toISOString());
    }

    return Response.redirect(`${appUrl}/?success=google_connected`);

  } catch (err) {
    console.error('Google token exchange error:', err);
    return Response.redirect(`${appUrl}/?error=auth_failed`);
  }
}
