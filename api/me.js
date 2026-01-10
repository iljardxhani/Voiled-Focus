import { verifySession } from './auth/callback.js';

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

export default async function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie || '');
  const session = verifySession(cookies.session);
  if (!session) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  res.status(200).json({ user: { sub: session.sub, email: session.email, name: session.name, picture: session.picture } });
}
