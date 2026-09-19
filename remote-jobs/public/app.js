const state = { view: 'overview', opps: [], filters: {} };

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

async function api(path, opts) {
  const res = await fetch('/api' + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.status);
  return data;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._to);
  t._to = setTimeout(() => t.classList.add('hidden'), 2600);
}

function fmtUsd(n) {
  if (n == null || isNaN(n)) return '—';
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function oppBadges(o) {
  const b = [];
  b.push({ cls: 'fit', text: 'Fit ' + (o.match_score || 0) });
  if (o.ghana_eligible) b.push({ cls: 'ghana', text: 'Ghana ✓' });
  if (o.estimated_usd && o.estimated_usd >= 2000) b.push({ cls: 'highvalue', text: 'High value' });
  if (o.deadline && o.deadline !== 'n/a') b.push({ cls: 'deadline', text: o.deadline.slice(0, 10) });
  if (o.scam_risk === 'high risk') b.push({ cls: 'risk', text: 'Risk' });
  else if (o.verification_status === 'Needs verification via platform page' || o.scam_risk === 'needs verification') b.push({ cls: 'verify', text: 'Verify' });
  if ((o.opp_type || o.category) === 'AI Economy' || o.opp_type === 'ai') b.push({ cls: 'ai', text: 'AI' });
  return b;
}

function oppCard(o) {
  const card = el('div', 'opp');
  const top = el('div', 'top');
  const t = el('div');
  const title = el('div', 't', o.title);
  if (o.company) title.appendChild(el('div', 'co', o.company));
  t.appendChild(title);
  const badges = el('div', 'badges');
  for (const b of oppBadges(o)) badges.appendChild(el('span', 'badge ' + b.cls, b.text));
  top.appendChild(t); top.appendChild(badges);
  const desc = el('div', 'co', (o.description || '').slice(0, 180));
  const foot = el('div', 'foot');
  const src = el('span', 'src', `${o.source || '—'} · ${o.opp_type || ''}${o.category ? ' · ' + o.category : ''}`);
  const right = el('span');
  right.appendChild(el('span', 'usd', fmtUsd(o.estimated_usd) + (o.compensation_raw ? '' : '')));
  const link = el('a', 'btn btn-sm', 'Details');
  link.href = o.url || '#';
  link.target = '_blank';
  const btn = el('button', 'btn btn-sm', 'Open');
  btn.onclick = () => openOpportunity(o);
  right.appendChild(btn);
  right.appendChild(link);
  foot.appendChild(src); foot.appendChild(right);
  card.appendChild(top); card.appendChild(desc); card.appendChild(foot);
  card.onclick = () => openOpportunity(o);
  return card;
}

function section(title, items, fallback) {
  const wrap = el('div');
  wrap.appendChild(el('h3', '', title));
  if (!items || !items.length) {
    const p = el('div', 'co', fallback || 'Nothing here yet — run Discovery.');
    wrap.appendChild(p);
    return wrap;
  }
  const grid = el('div', 'grid cols-2');
  for (const o of items) grid.appendChild(oppCard(o));
  wrap.appendChild(grid);
  return wrap;
}

// ---------------- Views ----------------

async function viewOverview() {
  const d = await api('/overview');
  const v = $('#view');
  v.innerHTML = '';
  v.appendChild(el('h1', '', 'Command Center'));
  v.appendChild(el('div', 'sub', `What can I do today, what pays fastest, what pays most, and how do I get paid from Ghana.`));

  const a = d.analytics.totals;
  const kpis = el('div', 'grid cols-4');
  const kpi = (num, cls, lbl) => {
    const p = el('div', 'panel kpi');
    p.appendChild(el('div', 'num ' + cls, String(num)));
    p.appendChild(el('div', 'lbl', lbl));
    return p;
  };
  kpis.appendChild(kpi(a.opportunities, 'good', 'Opportunities tracked'));
  kpis.appendChild(kpi(a.ghanaEligible, '', 'Ghana-eligible'));
  kpis.appendChild(kpi(a.highFit, 'good', 'High-fit (≥70)'));
  kpis.appendChild(kpi(d.analytics.fx?.usdToGhs ?? '—', '', '≈ GHS per $1 USD'));
  v.appendChild(kpis);

  const cols = el('div', 'grid cols-2');
  cols.appendChild(section('What can I apply for today?', d.cc.applyToday.slice(0, 4)));
  cols.appendChild(section('What pays fastest?', d.cc.fastest.slice(0, 4)));
  v.appendChild(cols);
  const cols2 = el('div', 'grid cols-2');
  cols2.appendChild(section('What pays the most?', d.cc.most.slice(0, 4)));
  cols2.appendChild(section('Recurring income candidates', d.cc.recurring.slice(0, 4)));
  v.appendChild(cols2);

  const pay = el('div', 'panel');
  pay.appendChild(el('h3', '', 'How can I get paid from Ghana?'));
  const table = el('table');
  const head = el('thead');
  head.appendChild(el('tr')).append(
    el('th', '', 'Rail'), el('th', '', 'Status'), el('th', '', 'Bank (GHS)'), el('th', '', 'Mobile Money'), el('th', '', 'Verified'),
  );
  const body = el('tbody');
  const pays = await api('/payments');
  for (const p of pays.slice(0, 6)) {
    const tr = el('tr');
    const name = el('td'); name.appendChild(el('div', '', p.name));
    name.appendChild(el('div', 'co', p.notes ? p.notes.slice(0, 70) : ''));
    tr.appendChild(name);
    tr.appendChild(el('td', '', p.status));
    tr.appendChild(el('td', '', p.withdraw_bank));
    tr.appendChild(el('td', '', p.mobile_money));
    tr.appendChild(el('td', '', p.verified_date || ''));
    body.appendChild(tr);
  }
  table.appendChild(head); table.appendChild(body);
  pay.appendChild(table);
  v.appendChild(pay);
}

async function viewRadar() {
  const d = await api('/radar');
  const v = $('#view');
  v.innerHTML = '';
  v.appendChild(el('h1', '', 'Opportunity Radar'));
  v.appendChild(el('div', 'sub', 'Today, deadlines, quick cash, high value, AI economy, AEC, consulting, build-your-own and hidden gems.'));
  const cols = el('div', 'grid cols-2');
  cols.appendChild(section('TODAY — best now', d.today.slice(0, 4)));
  cols.appendChild(section('DEADLINES closing soon', d.deadlines.slice(0, 4)));
  v.appendChild(cols);
  const cols2 = el('div', 'grid cols-2');
  cols2.appendChild(section('QUICK CASH', d.quickCash.slice(0, 4)));
  cols2.appendChild(section('HIGH VALUE', d.highValue.slice(0, 4)));
  v.appendChild(cols2);
  const cols3 = el('div', 'grid cols-2');
  cols3.appendChild(section('AI ECONOMY', d.ai.slice(0, 4)));
  cols3.appendChild(section('AEC', d.aec.slice(0, 4)));
  v.appendChild(cols3);
  const cols4 = el('div', 'grid cols-2');
  cols4.appendChild(section('GLOBAL CONSULTING', d.consulting.slice(0, 4)));
  cols4.appendChild(section('BUILD YOUR OWN (grants/competitions)', d.building.slice(0, 4)));
  v.appendChild(cols4);
  v.appendChild(section('HIDDEN GEMS — low competition, good fit', d.hidden.slice(0, 8), 'No hidden gems yet.'));
}

async function viewOpportunities() {
  const v = $('#view');
  const wrapFilters = {
    all: () => true,
    employment: (o) => o.opp_type === 'employment' || o.opp_type === 'career',
    freelance: (o) => o.opp_type === 'freelance',
    ai: (o) => o.opp_type === 'ai' || o.category === 'AI Economy',
    aec: (o) => (o.category || '').includes('AEC') || (o.category || '').includes('architecture') || (JSON.stringify(o.skills || '')).includes('AEC'),
    consulting: (o) => ['consulting', 'expert'].includes(o.opp_type) || (o.category || '').includes('Consulting') || (o.category || '').includes('Development'),
    research: (o) => (o.category || '').includes('Research') || (o.category || '').includes('Development') || (o.category || '').includes('Expert Networks'),
    grants: (o) => o.opp_type === 'building',
    'digital-products': (o) => (o.category || '').includes('Digital') || (o.category || '').includes('Asset'),
  };
  if (!state.opps.length) state.opps = (await api('/opportunities?limit=200')).items;
  v.innerHTML = '';
  v.appendChild(el('h1', '', 'Opportunities'));
  v.appendChild(el('div', 'sub', 'Browse the full opportunity database. Open a card for the application plan.'));

  const tabs = el('div', 'tabs');
  const labels = [
    ['all', 'All'], ['employment', 'Remote Jobs'], ['freelance', 'Freelance'], ['ai', 'AI Work'],
    ['aec', 'AEC'], ['consulting', 'Consulting'], ['research', 'Research'], ['grants', 'Grants'], ['digital-products', 'Digital Products'],
  ];
  let active = state.oppsFilter || 'all';
  for (const [k, l] of labels) {
    const b = el('button', 'tab-btn' + (active === k ? ' active' : ''), l);
    b.onclick = () => {
      state.oppsFilter = k;
      viewOpportunities();
    };
    tabs.appendChild(b);
  }
  v.appendChild(tabs);

  const bar = el('div', 'toolbar');
  const q = el('input'); q.placeholder = 'Search title / company / description…'; q.value = state.oppSearch || '';
  q.oninput = (e) => { state.oppSearch = e.target.value; paint(); };
  const selRisk = el('select');
  for (const [k, l] of [['all', 'All risks'], ['probably legitimate', 'Probably legit'], ['needs verification', 'Needs verification'], ['high risk', 'High risk']]) {
    const o = el('option', '', l); o.value = k; selRisk.appendChild(o);
  }
  selRisk.value = state.oppRisk || 'all';
  selRisk.onchange = (e) => { state.oppRisk = e.target.value; paint(); };
  const selGhana = el('select');
  for (const [k, l] of [['all', 'Any geography'], ['1', 'Ghana eligible'], ['0', 'Not Ghana']]) {
    const o = el('option', '', l); o.value = k; selGhana.appendChild(o);
  }
  selGhana.value = state.oppGhana || 'all';
  selGhana.onchange = (e) => { state.oppGhana = e.target.value; paint(); };
  bar.appendChild(q); bar.appendChild(selRisk); bar.appendChild(selGhana);
  const exportBtn = el('button', 'btn', 'Export CSV');
  exportBtn.onclick = async () => { window.open('/api/export.csv'); toast('Export started'); };
  bar.appendChild(exportBtn);
  v.appendChild(bar);

  const bar2 = el('div', 'sub', '');
  bar2.id = 'oppCount';
  v.appendChild(bar2);

  const out = el('div', 'grid cols-2', '');
  out.id = 'oppGrid';
  v.appendChild(out);

  function paint() {
    let list = state.opps.filter(wrapFilters[active] || (() => true));
    if (state.oppSearch) {
      const s = state.oppSearch.toLowerCase();
      list = list.filter((o) => (o.title + ' ' + o.company + ' ' + o.description).toLowerCase().includes(s));
    }
    if (state.oppRisk && state.oppRisk !== 'all') list = list.filter((o) => o.scam_risk === state.oppRisk);
    if (state.oppGhana && state.oppGhana !== 'all') list = list.filter((o) => String(o.ghana_eligible) === state.oppGhana);
    out.innerHTML = '';
    $('#oppCount').textContent = list.length + ' shown (sorted by fit score).';
    if (!list.length) out.appendChild(el('div', 'co', 'No opportunities match.'));
    else list.sort((a, b) => (b.match_score || 0) - (a.match_score || 0)).slice(0, 100).forEach((o) => out.appendChild(oppCard(o)));
  }
  paint();
}

async function viewPayments() {
  const pays = await api('/payments');
  const v = $('#view');
  v.innerHTML = '';
  v.appendChild(el('h1', '', 'Payment Intelligence'));
  v.appendChild(el('div', 'sub', 'Payment Compatibility Matrix for a Ghana-based professional. Verified 2026-09-19. Never assume a platform works from Ghana — check status and evidence.'));
  const table = el('table');
  const head = el('thead');
  head.appendChild(el('tr')).append(...['Platform', 'Ghana signup', 'Receive', 'Bank (GHS)', 'Mobile Money', 'Fees', 'Status', 'Verified', 'Evidence'].map((h) => el('th', '', h)));
  const body = el('tbody');
  for (const p of pays) {
    const tr = el('tr');
    tr.appendChild(el('td', '', p.name));
    tr.appendChild(el('td', '', p.ghana_signup));
    tr.appendChild(el('td', '', p.can_receive));
    tr.appendChild(el('td', '', p.withdraw_bank));
    tr.appendChild(el('td', '', p.mobile_money));
    tr.appendChild(el('td', '', p.fees));
    tr.appendChild(el('td', '', p.status));
    tr.appendChild(el('td', '', p.verified_date));
    tr.appendChild(el('td', 'co', (p.source || '').slice(0, 60)));
    body.appendChild(tr);
  }
  table.appendChild(head); table.appendChild(body);
  v.appendChild(table);
  const note = el('div', 'panel', '');
  note.appendChild(el('h3', '', 'Key 2026 findings'));
  note.appendChild(el('p', 'co', 'PayPal (receive) and direct Stripe merchant accounts are NOT available to Ghana residents. Wise is send-to only (clients can pay your Ghana bank). Payoneer, Deel, Remote, Paystack, Flutterwave and MTN MoMo are your workable receive rails. Source: PayoutMap May 2026, official provider pages, Raenest 2026 guides.'));
  v.appendChild(note);
}

async function viewSkills() {
  const skills = await api('/skills');
  const gap = (await api('/analytics')).gap;
  const v = $('#view');
  v.innerHTML = '';
  v.appendChild(el('h1', '', 'Skills & Gap Analysis'));
  v.appendChild(el('div', 'sub', 'Your capability profile. Market demand is a model estimate; level is editable. "Gap" = demand vs. your current level.'));
  const gapBox = el('div', 'grid cols-2');
  gapBox.appendChild(section('Skills that could unlock the most opportunities', gap.learningPriority.slice(0, 6).map((g) => ({ title: g.skill, description: `${g.category} · demand ${g.market_demand}/100 · your level ${g.level}/5 · gap ${g.gap}`, url: '#', company: 'learning priority', estimated_usd: null, match_score: g.market_demand, ghana_eligible: 1, source: 'Learning Agent', opp_type: g.action, category: g.category, scam_risk: 'probably legitimate' })), ''));
  v.appendChild(gapBox);
  const table = el('table');
  const head = el('thead');
  head.appendChild(el('tr')).append(...['Skill', 'Category', 'Level (1-5)', 'Market demand', 'Gap', 'Matching opportunities'].map((h) => el('th', '', h)));
  const body = el('tbody');
  const opps = state.opps.length ? state.opps : (await api('/opportunities?limit=200')).items;
  for (const s of skills) {
    const count = opps.filter((o) => (o.skills || []).some((k) => k.id === s.id)).length;
    const tr = el('tr');
    tr.appendChild(el('td', '', s.name));
    tr.appendChild(el('td', '', s.category));
    const lvl = el('td');
    const range = el('input'); range.type = 'range'; range.min = 1; range.max = 5; range.value = s.level;
    const lvlNum = el('span', '', ' ' + s.level);
    range.oninput = (e) => { lvlNum.textContent = ' ' + e.target.value; saveSkill(s.id, Number(e.target.value)); };
    lvl.appendChild(range); lvl.appendChild(lvlNum);
    tr.appendChild(lvl);
    tr.appendChild(el('td', '', s.market_demand + '/100'));
    const g = 'gap';
    const gapV = (s.market_demand || 50) - s.level * 20;
    tr.appendChild(el('td', gapV > 20 ? 'danger' : '', gapV > 20 ? 'High' : gapV > 0 ? 'Some' : 'OK'));
    tr.appendChild(el('td', '', String(count)));
    body.appendChild(tr);
  }
  table.appendChild(head); table.appendChild(body);
  v.appendChild(table);

  async function saveSkill(id, level) {
    await api('/skills', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ updates: [{ id, level }] }) });
  }
}

async function viewPortfolio() {
  const p = await api('/portfolio');
  const v = $('#view');
  v.innerHTML = '';
  v.appendChild(el('h1', '', 'Portfolio Evidence'));
  v.appendChild(el('div', 'sub', 'Recommend these when applying. Each maps to opportunity categories.'));
  const grid = el('div', 'grid cols-2');
  for (const x of p) {
    const card = el('div', 'panel');
    card.appendChild(el('h3', '', x.title));
    card.appendChild(el('p', 'co', 'Problem: ' + x.problem));
    card.appendChild(el('p', 'co', 'Outcome: ' + x.outcome));
    card.appendChild(el('div', 'badges', ''));
    const b = card.lastChild;
    for (const c of (JSON.parse(x.categories || '[]'))) b.appendChild(el('span', 'badge', c));
    for (const s of (JSON.parse(x.skills || '[]'))) b.appendChild(el('span', 'badge', s));
    grid.appendChild(card);
  }
  v.appendChild(grid);
}

async function viewApplications() {
  const d = await api('/applications');
  const v = $('#view');
  v.innerHTML = '';
  v.appendChild(el('h1', '', 'Application Pipeline'));
  v.appendChild(el('div', 'sub', 'Track every application. Ask the system for a plan on any opportunity, then move it through the pipeline.'));
  const stages = d.stages;
  const cols = el('div', 'grid cols-2');
  let idx = 0;
  for (const [key, label] of Object.entries(stages)) {
    const items = d.items.filter((a) => a.stage === key);
    const panel = el('div', 'panel');
    panel.appendChild(el('h3', '', `${label} (${items.length})`));
    for (const a of items) {
      const row = el('div', 'opp');
      row.appendChild(el('div', 't', a.title || a.opportunity_id));
      if (a.company) row.appendChild(el('div', 'co', a.company));
      const foot = el('div', 'foot');
      foot.appendChild(el('span', 'src', `${a.applied_at ? 'Applied ' + a.applied_at.slice(0, 10) : ''} ${a.follow_up_at ? '· follow-up ' + a.follow_up_at : ''}`));
      const adv = el('button', 'btn btn-sm', stages[a.stage] && ['applied', 'interview', 'offer', 'won'].includes(a.stage) === false ? 'Advance' : 'Update');
      adv.onclick = () => advance(a);
      foot.appendChild(adv);
      row.appendChild(foot);
      panel.appendChild(row);
    }
    cols.appendChild(panel);
  }
  v.appendChild(cols);

  async function advance(a) {
    const order = ['discovered', 'reviewed', 'shortlisted', 'preparing', 'applied', 'interview', 'offer', 'won', 'paid'];
    const cur = a.stage;
    const next = order[Math.min(order.indexOf(cur) + 1, order.length - 1)];
    await api('/applications/' + a.id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stage: next }) });
    toast(`Moved to ${next}`);
    viewApplications();
  }
}

async function viewAnalytics() {
  const d = await api('/analytics');
  const v = $('#view');
  v.innerHTML = '';
  v.appendChild(el('h1', '', 'Analytics'));
  v.appendChild(el('div', 'sub', 'Which categories actually produce results. Fill in the pipeline and this becomes your ROI map.'));
  const t = d.totals;
  const kpis = el('div', 'grid cols-4');
  const kpi = (n, c, l) => { const p = el('div', 'panel kpi'); p.appendChild(el('div', 'num ' + c, String(n))); p.appendChild(el('div', 'lbl', l)); return p; };
  kpis.appendChild(kpi(t.opportunities, 'good', 'Opportunities'));
  kpis.appendChild(kpi(t.ghanaEligible, '', 'Ghana-eligible'));
  kpis.appendChild(kpi(t.applications, '', 'Applications'));
  kpis.appendChild(kpi(t.wins, 'good', 'Wins'));
  v.appendChild(kpis);

  const cols = el('div', 'grid cols-2');
  const conv = el('div', 'panel');
  conv.appendChild(el('h3', '', 'Funnel'));
  conv.appendChild(el('div', 'score-row')).append(el('span', 'lbl', 'Applications → Interview'), el('span', '', (d.conversion.applicationToInterviewPct ?? '—') + '%'));
  conv.appendChild(el('div', 'score-row')).append(el('span', 'lbl', 'Interview → Win'), el('span', '', (d.conversion.interviewToWinPct ?? '—') + '%'));
  cols.appendChild(conv);

  const byType = el('div', 'panel');
  byType.appendChild(el('h3', '', 'Opportunities by type'));
  for (const x of d.byType.slice(0, 8)) {
    const mx = Math.max(1, ...d.byType.map((y) => y.c));
    const row = el('div', 'score-row');
    row.appendChild(el('span', 'lbl', x.opp_type));
    const bar = el('div', 'metric-bar');
    const w = el('span'); w.style.width = (x.c / mx * 100) + '%';
    bar.appendChild(w);
    row.appendChild(bar);
    byType.appendChild(row);
  }
  cols.appendChild(byType);
  v.appendChild(cols);
  v.appendChild(section('Income by platform (from your application records)', d.bySource.slice(0, 6).map((s) => ({ title: s.source, description: s.c + ' researched opportunities', company: '', estimated_usd: null, match_score: s.c, ghana_eligible: 0, source: s.source, opp_type: 'platform', category: '', scam_risk: 'probably legitimate' })), 'No platform data yet.'));
}

async function viewSources() {
  const src = await api('/sources');
  const v = $('#view');
  v.innerHTML = '';
  v.appendChild(el('h1', '', 'Source Registry'));
  v.appendChild(el('div', 'sub', 'Discovery sources. Enable RSS/JSON sources to have the Scout Agent poll them; HTML/manual sources are reviewed by hand or search.'));
  const table = el('table');
  const head = el('thead');
  head.appendChild(el('tr')).append(...['Source', 'Type', 'Access', 'Reliability', 'Enabled', 'Last success', '# items'].map((h) => el('th', '', h)));
  const body = el('tbody');
  for (const s of src) {
    const tr = el('tr');
    tr.appendChild(el('td', '', s.name));
    tr.appendChild(el('td', '', s.type));
    tr.appendChild(el('td', '', s.access_method));
    tr.appendChild(el('td', '', s.reliability));
    const tdE = el('td');
    const ck = el('input'); ck.type = 'checkbox'; ck.checked = !!s.enabled;
    ck.onchange = async (e) => { await api('/sources/' + s.id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: e.target.checked ? 1 : 0 }) }); toast('Source toggled'); };
    tdE.appendChild(ck);
    tr.appendChild(tdE);
    tr.appendChild(el('td', '', (s.last_success || '—').slice(0, 10)));
    tr.appendChild(el('td', '', String(s.last_count || 0)));
    body.appendChild(tr);
  }
  table.appendChild(head); table.appendChild(body);
  v.appendChild(table);
}

async function viewReports() {
  const d = await api('/reports');
  const v = $('#view');
  v.innerHTML = '';
  v.appendChild(el('h1', '', 'Intelligence Reports'));
  v.appendChild(el('div', 'sub', 'Daily and weekly intelligence. Generated automatically after each discovery run.'));
  const daily = el('div', 'panel');
  daily.appendChild(el('h3', '', 'Latest Daily Report'));
  daily.appendChild(el('pre', 'report', d.daily || 'Run discovery first.'));
  v.appendChild(daily);
  const weekly = el('div', 'panel');
  weekly.appendChild(el('h3', '', 'Latest Weekly Report'));
  weekly.appendChild(el('pre', 'report', d.weekly || 'No weekly report yet.'));
  v.appendChild(weekly);
}

async function viewSettings() {
  const d = await api('/settings');
  const v = $('#view');
  v.innerHTML = '';
  v.appendChild(el('h1', '', 'Settings'));
  v.appendChild(el('div', 'sub', 'Scoring weights are transparent — change them and every fit score recomputes.'));
  const panel = el('div', 'panel');
  panel.appendChild(el('h3', '', 'Opportunity Fit Score weights'));
  const grid = el('div', 'grid cols-2');
  for (const [k, val] of Object.entries(d.weights)) {
    const row = el('div', 'score-row');
    const lbl = el('span', 'lbl', label(k));
    const bar = el('span', 'val');
    const range = el('input'); range.type = 'range'; range.min = 0; range.max = 50; range.value = val;
    const vnum = el('span', '', ' ' + val);
    range.oninput = () => vnum.textContent = ' ' + range.value;
    range.onchange = async () => {
      const newW = { ...d.weights, [k]: Number(range.value) };
      await api('/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ weights: newW }) });
      toast('Weights saved');
    };
    bar.appendChild(range); bar.appendChild(vnum);
    row.appendChild(lbl); row.appendChild(bar);
    grid.appendChild(row);
  }
  panel.appendChild(grid);
  v.appendChild(panel);

  const mode = el('div', 'panel');
  mode.appendChild(el('h3', '', 'ANY LEGITIMATE REMOTE WORK mode (§34)'));
  const ckLbl = el('label', '', '');
  const ck = el('input'); ck.type = 'checkbox'; ck.checked = !!d.anyTaskMode;
  ck.onchange = async (e) => { await api('/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ anyTaskMode: e.target.checked }) }); toast('Any-task mode ' + (e.target.checked ? 'ON' : 'OFF')); };
  ckLbl.appendChild(ck); ckLbl.appendChild(el('span', '', ' Include customer support, data entry, moderation, testing, AI evaluation and other legitimate tasks even when they are not directly aligned with your professional profile.'));
  mode.appendChild(ckLbl);
  v.appendChild(mode);

  const reset = el('div', 'panel');
  reset.appendChild(el('h3', '', 'Data'));
  const rbtn = el('button', 'btn btn-danger', 'Reset pipeline data (reseed)');
  rbtn.onclick = async () => { if (confirm('Reset? This wipes opportunities/applications/reports and reseeds.')) { await fetch('/api/admin/reset', { method: 'POST' }); location.reload(); } };
  reset.appendChild(rbtn);
  v.appendChild(reset);

  function label(k) {
    return { skill_match: 'Skill Match', ghana: 'Ghana Accessibility', payment: 'Payment Compatibility', income: 'Income Potential', application_ease: 'Application Ease', recurring: 'Recurring Potential', strategic: 'Strategic Value', freshness: 'Freshness' }[k] || k;
  }
}

// ---------------- Modal ----------------

async function openOpportunity(o) {
  let data = { opportunity: o };
  try { data = await api('/opportunities/' + o.id); } catch {}
  const opp = data.opportunity || o;
  const plan = data.plan;
  $('#modalTitle').textContent = opp.title;
  const body = $('#modalBody');
  body.innerHTML = '';

  const head = el('div', '', '');
  head.appendChild(el('div', 'co', `${opp.company || '—'} · ${opp.source || ''} · ${opp.geo_eligibility || ''} · Ghana ${opp.ghana_eligible ? 'eligible' : String(opp.ghana_eligible)}`));
  const badges = el('div', 'badges', '');
  for (const b of oppBadges(opp)) badges.appendChild(el('span', 'badge ' + b.cls, b.text));
  head.appendChild(badges);
  body.appendChild(head);

  const meta = el('div', 'grid cols-3', '');
  const m1 = el('div', 'panel'); m1.appendChild(el('h3', '', 'Compensation')); m1.appendChild(el('div', '', fmtUsd(opp.estimated_usd))); if (opp.compensation_raw) m1.appendChild(el('div', 'co', opp.compensation_raw));
  const m2 = el('div', 'panel'); m2.appendChild(el('h3', '', 'Deadline')); m2.appendChild(el('div', '', opp.deadline && opp.deadline !== 'n/a' ? opp.deadline : 'Not stated')); m2.appendChild(el('div', 'co', 'Application effort: ' + (opp.application_effort || 3) + '/5'));
  const m3 = el('div', 'panel'); m3.appendChild(el('h3', '', 'Payment route')); m3.appendChild(el('div', '', plan?.paymentRoute || opp.ghana_payment_compat?.channels?.[0] || '—'));
  meta.appendChild(m1); meta.appendChild(m2); meta.appendChild(m3);
  body.appendChild(meta);

  const breakdown = el('div', 'panel');
  breakdown.appendChild(el('h3', '', `WHY THIS SCORE: Fit ${opp.match_score}/100`));
  const comps = opp.score_breakdown || {};
  for (const [k, v] of Object.entries(comps.components || {})) {
    const row = el('div', 'score-row');
    row.appendChild(el('span', 'lbl', (comps.labels || {})[k] || k));
    const bar = el('div', 'metric-bar'); const w = el('span'); w.style.width = v + '%'; bar.appendChild(w);
    const box = el('span');
    box.appendChild(bar); box.appendChild(el('span', '', ' ' + v));
    row.appendChild(box);
    breakdown.appendChild(row);
  }
  body.appendChild(breakdown);

  if (plan) {
    body.appendChild(el('h2', '', 'Application Assistant'));
    const why = el('div', 'panel'); why.appendChild(el('h3', '', 'Why you match')); why.appendChild(el('p', 'co', plan.whyMatch)); body.appendChild(why);
    const chk = el('div', 'panel'); chk.appendChild(el('h3', '', 'Checklist'));
    const ul = el('ol', '', ''); for (const c of plan.checklist) ul.appendChild(el('li', '', c)); chk.appendChild(ul); body.appendChild(chk);
    const po = el('div', 'panel'); po.appendChild(el('h3', '', 'Portfolio to show')); po.appendChild(el('p', 'co', plan.portfolioRecommendations.length ? plan.portfolioRecommendations.join(' · ') : 'Add portfolio cases')); body.appendChild(po);
    const pr = el('div', 'panel'); pr.appendChild(el('h3', '', 'Proposal draft (edit before use)')); pr.appendChild(el('pre', 'report', plan.proposal)); body.appendChild(pr);
    const qq = el('div', 'panel'); qq.appendChild(el('h3', '', 'Questions to prepare')); for (const q of plan.questionsToPrepare) qq.appendChild(el('div', 'co', '· ' + q)); body.appendChild(qq);
    body.appendChild(el('div', 'co', 'Suggested follow-up: ' + plan.followUpDate + (plan.pricingSuggestion ? ' · ' + plan.pricingSuggestion : '')));
  }

  const actions = el('div', 'toolbar', '');
  const applyBtn = el('button', 'btn btn-primary', 'Track application');
  applyBtn.onclick = async () => {
    await api('/applications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ opportunity_id: opp.id, stage: 'preparing' }) });
    toast('Added to Applications → Preparing');
  };
  actions.appendChild(applyBtn);
  const openBtn = el('a', 'btn', 'Open original listing ↗'); openBtn.href = opp.apply_url || opp.url || '#'; openBtn.target = '_blank';
  actions.appendChild(openBtn);
  body.appendChild(actions);
  $('#modal').classList.remove('hidden');
}

// ---------------- Boot ----------------

function bindNav() {
  $('#nav').addEventListener('click', async (e) => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
    btn.classList.add('active');
    state.view = btn.dataset.view;
    await render(state.view);
  });
}

async function render(view) {
  try {
    if (view === 'overview') await viewOverview();
    else if (view === 'radar') await viewRadar();
    else if (view === 'opportunities') await viewOpportunities();
    else if (view === 'payments') await viewPayments();
    else if (view === 'skills') await viewSkills();
    else if (view === 'portfolio') await viewPortfolio();
    else if (view === 'applications') await viewApplications();
    else if (view === 'analytics') await viewAnalytics();
    else if (view === 'sources') await viewSources();
    else if (view === 'reports') await viewReports();
    else if (view === 'settings') await viewSettings();
  } catch (e) {
    toast('Error: ' + e.message);
    console.error(e);
  }
}

$('#modalClose').onclick = () => $('#modal').classList.add('hidden');
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('#modal').classList.add('hidden'); });
$('#btnDiscover').onclick = async () => {
  const btn = $('#btnDiscover');
  btn.disabled = true; btn.textContent = 'Discovering…';
  try {
    const r = await api('/discover', { method: 'POST' });
    toast(`Discovery: +${r.added} new (${r.fetched} fetched, ${r.dupes} dupes)`);
    state.opps = (await api('/opportunities?limit=200')).items;
  } catch (e) { toast('Discovery error: ' + e.message); }
  finally { btn.disabled = false; btn.textContent = 'Run Discovery'; }
};

function boot() {
  bindNav();
  render('overview');
  api('/overview').then((d) => {
    const fx = d.analytics?.fx;
    $('#fxLine').textContent = fx?.usdToGhs ? `≈ GHS ${fx.usdToGhs} / $1 USD\n${fx.at || ''}`.split('\n').join(' · ') : '';
  }).catch(() => {});
}

document.addEventListener('DOMContentLoaded', boot);