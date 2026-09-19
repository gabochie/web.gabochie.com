// Source adapters (§26): RSS, JSON, and simple HTML extraction. Zero dependencies.

import { config } from '../config.js';
import { log } from '../logger.js';

const UA = 'GlobalOpportunityRadar/0.1 (personal coder)';

export async function fetchWithTimeout(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'application/rss+xml, application/json, text/xml, text/html, */*' },
    signal: AbortSignal.timeout(config.discovery.fetchTimeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function decodeXml(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseRSS(xmlText) {
  const items = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xmlText))) {
    const block = m[1];
    const g = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
      return r ? decodeXml(r[1]).trim() : '';
    };
    const title = g('title');
    if (!title) continue;
    const link = g('link');
    items.push({
      title,
      url: link,
      description: g('description'),
      company: '',
      country: '',
      compensation_raw: '',
      date: g('pubDate') || g('dc:date'),
      raw: block,
    });
  }
  return items;
}

function parseJSON(text) {
  let data;
  try { data = JSON.parse(text); } catch { return []; }
  const arr = Array.isArray(data) ? data : data.jobs || data.data || [];
  if (!Array.isArray(arr)) return [];
  return arr.map((j) => ({
    title: j.position || j.title || j.name || '',
    url: j.url || j.link || j.application_url || j.id ? j.url : '',
    company: j.company || j.organization || j.team || '',
    description: j.description || j.body || j.content || j.summary || '',
    country: j.country || j.location || '',
    compensation_raw: j.salary || j.compensation || (j.salary_min ? `$${j.salary_min}-${j.salary_max || ''}` : ''),
    date: j.date || j.created_at || j.published_at || j.pubDate || '',
  })).filter((x) => x.title);
}

function parseHTMLSimple(text, sourceUrl = '') {
  // Minimal, safe extraction for job-board HTML pages with typical markup.
  const items = [];
  const titleRe = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  const linkRe = /href="([^"]+)"/gi;
  const seen = new Set();
  let m;
  while ((m = titleRe.exec(text))) {
    const title = decodeXml(m[1]).replace(/<[^>]+>/g, '').trim();
    if (title.length < 6 || title.length > 160) continue;
    // find nearest href before this title match
    const before = text.slice(0, m.index);
    const links = [...before.matchAll(linkRe)];
    const href = links.length ? links[links.length - 1][1] : '';
    if (!href) continue;
    if (/^#/.test(href)) continue;
    const url = /^http/i.test(href) ? href : sourceUrl + (href.startsWith('/') ? href : '/' + href);
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ title, url, company: '', description: '', country: '', compensation_raw: '', date: '' });
  }
  return items;
}

export async function fetchSource(kind, url) {
  const text = await fetchWithTimeout(url);
  if (kind === 'rss') return parseRSS(text);
  if (kind === 'json') return parseJSON(text);
  if (kind === 'html') return parseHTMLSimple(text, new URL(url).origin);
  return [];
}