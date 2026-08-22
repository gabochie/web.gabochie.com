import { PortalHub } from './hub.js';

export { PortalHub };

const COOKIE_NAME = 'wg_portal_session';
const ALLOWED_ORIGINS = ['https://web.gabochie.com', 'http://localhost:8787', 'http://127.0.0.1:8787'];
const LEAD_ORIGINS = ['https://web.gabochie.com', 'http://localhost:8788', 'http://127.0.0.1:8788'];

async function verifyTurnstileToken(secret, token, ip) {
  if (!secret) return true; // not configured -> check disabled
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secret, response: token, remoteip: ip || '' })
    });
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    return false;
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, extraHeaders)
  });
}

function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const out = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return out;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function sessionCookie(token, maxAgeSeconds) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/api/portal; Max-Age=${maxAgeSeconds}`;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    return {};
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ---------- public lead capture (audit form) ----------
    if (path === '/api/lead' || path === '/api/lead/admin/list') {
      const origin = request.headers.get('Origin');
      if (origin && !LEAD_ORIGINS.includes(origin)) return json({ error: 'Forbidden origin' }, 403);

      const hub = env.PORTAL_HUB.getByName('main');
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

      if (path === '/api/lead' && request.method === 'POST') {
        const body = await readJson(request);
        const turnstileOk = await verifyTurnstileToken(env.TURNSTILE_SECRET, body.turnstileToken, ip);
        if (!turnstileOk) return json({ error: 'Bot check failed. Please retry.' }, 403);
        const result = await hub.addLead(ip, body);
        if (!result.ok) return json({ error: result.error }, result.status);
        if (result.lead) ctx.waitUntil(hub.sendLeadNotification(result.lead));
        return json({ ok: true });
      }

      if (path === '/api/lead/admin/list' && request.method === 'GET') {
        const authHeader = request.headers.get('Authorization') || '';
        const adminToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        const result = await hub.adminListLeads(adminToken);
        return result.ok ? json(result) : json({ error: result.error }, result.status);
      }

      return json({ error: 'Not found' }, 404);
    }

    if (!path.startsWith('/api/portal/') || path === '/api/portal/') {
      return json({ error: 'Not found' }, 404);
    }
    const origin = request.headers.get('Origin');
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: 'Forbidden origin' }, 403);
    }

    const hub = env.PORTAL_HUB.getByName('main');
    const portalPath = url.pathname.slice('/api/portal'.length);
    const method = request.method;

    // ---------- public ----------
    if (portalPath === '/login' && method === 'POST') {
      const body = await readJson(request);
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const result = await hub.login(body.email, body.password, ip);
      if (!result.ok) return json({ error: result.error }, result.status);
      return json({ ok: true, company: { id: result.company.id, name: result.company.name } }, 200, {
        'Set-Cookie': sessionCookie(result.token, 7 * 24 * 60 * 60)
      });
    }

    // ---------- admin (bearer token) ----------
    if (portalPath.startsWith('/admin/')) {
      const authHeader = request.headers.get('Authorization') || '';
      const adminToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const expected = env.PORTAL_ADMIN_TOKEN;
      let authorized = false;
      if (expected && adminToken) {
        const a = await sha256Hex(adminToken);
        const b = await sha256Hex(expected);
        if (a.length === b.length) {
          authorized = crypto.subtle.timingSafeEqual
            ? crypto.subtle.timingSafeEqual(new TextEncoder().encode(a), new TextEncoder().encode(b))
            : a === b;
        }
      }
      if (!authorized) return json({ error: 'Forbidden' }, 403);

      if (portalPath === '/admin/companies' && method === 'GET') {
        return json({ companies: await hub.adminListCompanies() });
      }
      if (portalPath === '/admin/provision' && method === 'POST') {
        const body = await readJson(request);
        const result = await hub.adminProvision(adminToken, body);
        return result.ok ? json(result) : json({ error: result.error }, result.status);
      }
      return json({ error: 'Not found' }, 404);
    }

    // ---------- authenticated client endpoints ----------
    const cookies = parseCookies(request);
    const tokenHash = cookies[COOKIE_NAME] ? await sha256Hex(cookies[COOKIE_NAME]) : null;
    const session = await hub.getSession(tokenHash);

    if (portalPath === '/logout' && method === 'POST') {
      await hub.logout(tokenHash);
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
    }

    if (!session) return json({ error: 'Unauthorized' }, 401);

    if (portalPath === '/me' && method === 'GET') {
      return json({
        email: session.email,
        company: {
          name: session.company.name,
          industry: session.company.industry,
          location: session.company.location,
          tier: session.company.tier,
          startDate: session.company.start_date,
          deliveryDate: session.company.delivery_date
        }
      });
    }

    if (portalPath === '/bootstrap' && method === 'GET') {
      const data = await hub.bootstrap(session.companyId);
      return json(data);
    }

    if (portalPath === '/feedback' && method === 'POST') {
      const body = await readJson(request);
      const result = await hub.addFeedback(session.companyId, body);
      return result.ok ? json(result) : json({ error: result.error }, result.status);
    }

    if (portalPath === '/files') {
      if (method === 'GET' && url.searchParams.get('id')) {
        const file = await hub.getFile(session.companyId, url.searchParams.get('id'));
        if (!file || !file.data) return json({ error: 'Not found' }, 404);
        return new Response(file.data, {
          headers: {
            'Content-Type': file.mime || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${file.name.replace(/[^\w.\- ]+/g, '_')}"`,
            'Cache-Control': 'private, no-store'
          }
        });
      }
      if (method === 'POST') {
        const body = await readJson(request);
        const result = await hub.addFile(session.companyId, session.email, body);
        return result.ok ? json(result) : json({ error: result.error }, result.status);
      }
    }

    return json({ error: 'Not found' }, 404);
  }
};
