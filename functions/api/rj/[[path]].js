/* Remote Jobs API — D1-backed GOR port.
   Routes: /api/rj/*  (static dashboard at /remote-jobs/ calls this).
   Binding: RJ_DB (D1). */
import { bindD1, db } from '../../_lib/rj/src/db.js';
import { handleApi } from '../../_lib/rj/src/api.js';

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequest(context) {
  try {
    if (context.request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (!context.env.RJ_DB) {
      return json({ error: 'RJ_DB (D1) binding not configured' }, 500);
    }
    bindD1(context.env.RJ_DB);
    await db();

    const url = new URL(context.request.url);
    const path = (url.pathname || '').replace(/^\/api\/rj\/?/, '').split('/').filter(Boolean);

    let body = {};
    if (context.request.method === 'POST' || context.request.method === 'PATCH') {
      try {
        const text = await context.request.text();
        if (text) body = JSON.parse(text);
      } catch (e) {
        return json({ error: 'Invalid JSON body' }, 400);
      }
    }

    const out = await handleApi(path, url, context.request.method, body);

    if (out.contentType && !String(out.contentType).startsWith('application/json')) {
      return new Response(out.body, {
        status: out.status,
        headers: {
          'Content-Type': out.contentType,
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    return json(out.body, out.status);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}