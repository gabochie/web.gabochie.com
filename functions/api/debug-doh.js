// TEMPORARY diagnostics — remove after debugging
export async function onRequestGet() {
  const out = {};
  out.timeoutSupport = typeof AbortSignal.timeout;

  try {
    const res = await fetch('https://cloudflare-dns.com/dns-query?name=example.com&type=A', {
      headers: { 'accept': 'application/dns-json' }
    });
    out.dohPlain = { status: res.status, ok: res.ok };
    if (res.ok) {
      const j = await res.json();
      out.dohPlainJson = { Status: j.Status, answers: j.Answer ? j.Answer.length : 0 };
    }
  } catch (e) {
    out.dohPlainError = String(e && e.message || e);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://cloudflare-dns.com/dns-query?name=this-domain-does-not-exist-gx7q.com&type=A', {
      headers: { 'accept': 'application/dns-json' },
      signal: controller.signal
    });
    clearTimeout(timer);
    out.dohNx = { status: res.status };
    out.dohNxBody = await res.text();
  } catch (e) {
    out.dohNxError = String(e && e.message || e);
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
