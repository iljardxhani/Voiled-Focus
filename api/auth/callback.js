import { createHmac } from 'crypto';
import { OAuth2Client } from 'google-auth-library';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const sessionSecret = process.env.SESSION_SECRET || 'dev-session-secret';
const baseUrlFromEnv = process.env.BASE_URL;

function baseUrl(req) {
  if (baseUrlFromEnv) return baseUrlFromEnv.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers.host;
  return `${proto}://${host}`;
}

function parseCookies(header) {
  return Object.fromEntries(
    (header || '')
      .split(';')
      .map(v => v.trim())
      .filter(Boolean)
      .map(v => {
        const idx = v.indexOf('=');
        if (idx === -1) return [v, ''];
        return [decodeURIComponent(v.slice(0, idx)), decodeURIComponent(v.slice(idx + 1))];
      })
  );
}

function signSession(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', sessionSecret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifySession(token) {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = createHmac('sha256', sessionSecret).update(data).digest('base64url');
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (!clientId || !clientSecret) {
    res.status(500).send('Missing Google OAuth env vars');
    return;
  }

  const { code, state } = req.query || {};
  const cookies = parseCookies(req.headers.cookie || '');
  const savedState = cookies.oauth_state;
  const codeVerifier = cookies.code_verifier;

  if (!state || !savedState || state !== savedState || !codeVerifier) {
    res.status(400).send('Invalid state');
    return;
  }

  const redirectUri = `${baseUrl(req)}/api/auth/callback`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    res.status(400).send(`Token exchange failed: ${text}`);
    return;
  }

  const tokens = await tokenRes.json();
  const idToken = tokens.id_token;
  if (!idToken) {
    res.status(400).send('Missing id_token');
    return;
  }

  const oauthClient = new OAuth2Client(clientId);
  const ticket = await oauthClient.verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload) {
    res.status(400).send('Invalid token payload');
    return;
  }

  const user = {
    sub: payload.sub,
    email: payload.email,
    name: payload.name || '',
    picture: payload.picture || '',
  };

  const exp = Date.now() + 60 * 60 * 1000; // 1h
  const sessionToken = signSession({ ...user, exp });

  res.setHeader('Set-Cookie', [
    'oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'code_verifier=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`,
  ]);

  res.writeHead(302, { Location: '/' });
  res.end();
}

// Export helper for reuse
export { verifySession };
