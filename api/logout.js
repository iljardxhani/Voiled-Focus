export default async function handler(req, res) {
  res.setHeader('Set-Cookie', [
    'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'code_verifier=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
  ]);
  res.status(200).json({ ok: true });
}
