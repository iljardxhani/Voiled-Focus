import { randomUUID, randomBytes, createHash } from 'crypto';

const clientId = process.env.GOOGLE_CLIENT_ID;
const baseUrlFromEnv = process.env.BASE_URL;

function baseUrl(req) {
  if (baseUrlFromEnv) return baseUrlFromEnv.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers.host;
  return `${proto}://${host}`;
}

function toCodeChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url');
}

export default async function handler(req, res) {
  if (!clientId) {
    res.status(500).send('Missing GOOGLE_CLIENT_ID');
    return;
  }

  const state = randomUUID();
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = toCodeChallenge(codeVerifier);
  const redirectUri = `${baseUrl(req)}/api/auth/callback`;

  res.setHeader('Set-Cookie', [
    `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    `code_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  ]);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  res.end();
}
