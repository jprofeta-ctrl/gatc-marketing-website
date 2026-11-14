// GATC demo gateway — REVIEW ONLY. Do not deploy until the public demo URL is retired/restricted.
// Required bindings: DEMO_CONTENT (KV), ACCEPTANCE_LOG (KV), SESSION_SECRET (secret).
// KV keys: agreement.html and index.html. Both HTML files are served from THIS Worker origin.
// Acceptance logs contain personal information: define a retention policy and privacy notice before launch.
const VERSION = '2026-11-draft';
const COOKIE = '__Host-gatc_demo';
const SESSION_SECONDS = 7200;
const encoder = new TextEncoder();
const common = {
  'Cache-Control': 'no-store, private',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
function respond(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { ...common, ...extra } });
}
function redirect(path, extra = {}) {
  return respond(null, 303, { Location: path, ...extra });
}
function hex(bytes) {
  return Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
}
async function signature(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
async function sessionAllowed(request, env) {
  const cookie = (request.headers.get('Cookie') || '').split(';').map(s => s.trim())
    .find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!cookie) return false;
  const parts = cookie.split('.');
  if (parts.length !== 3) return false;
  const [id, expires, sig] = parts;
  if (!/^[a-f0-9]{32}$/.test(id) || !/^\d{13}$/.test(expires) || !/^[a-f0-9]{64}$/.test(sig)) return false;
  if (Number(expires) <= Date.now() || Number(expires) > Date.now() + SESSION_SECONDS * 1000) return false;
  return constantTimeEqual(await signature(env.SESSION_SECRET, id + '.' + expires), sig);
}
async function parseForm(request) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.startsWith('application/x-www-form-urlencoded') && !type.startsWith('multipart/form-data')) return null;
  const body = await request.arrayBuffer();
  if (body.byteLength > 4096) return null;
  return new Request('https://form.invalid/', { method: 'POST', headers: { 'Content-Type': type }, body }).formData().catch(() => null);
}
export default {
  async fetch(request, env) {
    if (!env.DEMO_CONTENT || !env.ACCEPTANCE_LOG || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32)
      return respond('Gateway configuration incomplete', 503);
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (pathname === '/accept' && request.method === 'POST') {
      if (request.headers.get('Origin') !== url.origin) return respond('Invalid request origin', 403);
      const form = await parseForm(request).catch(() => null);
      if (!form) return respond('Invalid or oversized form', 400);
      const name = String(form.get('name') || '').trim();
      const company = String(form.get('company') || '').trim();
      const email = String(form.get('email') || '').trim();
      if (name.length < 2 || name.length > 120 || company.length < 2 || company.length > 150 ||
          email.length < 5 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          form.get('agree') !== 'yes') return respond('Complete all fields and accept the agreement', 400);
      const id = hex(crypto.getRandomValues(new Uint8Array(16)));
      const acceptedAt = new Date().toISOString();
      try {
        await env.ACCEPTANCE_LOG.put('acceptance:' + id, JSON.stringify({
          name, company, email, acceptedAt, agreementVersion: VERSION
        }));
      } catch {
        return respond('Unable to record agreement; please try again', 503);
      }
      const expires = String(Date.now() + SESSION_SECONDS * 1000);
      const sig = await signature(env.SESSION_SECRET, id + '.' + expires);
      return redirect('/demo', {
        'Set-Cookie': COOKIE + '=' + id + '.' + expires + '.' + sig +
          '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + SESSION_SECONDS
      });
    }
    if (pathname === '/' && request.method === 'GET') {
      const html = await env.DEMO_CONTENT.get('agreement.html');
      return html ? respond(html, 200, { 'Content-Type': 'text/html; charset=utf-8' }) :
        respond('Agreement page not configured', 503);
    }
    if (pathname === '/demo' && request.method === 'GET') {
      if (!(await sessionAllowed(request, env))) return redirect('/');
      const html = await env.DEMO_CONTENT.get('index.html');
      return html ? respond(html, 200, { 'Content-Type': 'text/html; charset=utf-8' }) :
        respond('Demo page not configured', 503);
    }
    if (pathname === '/favicon.ico') return respond(null, 204);
    return respond('Not found', 404);
  }
};
