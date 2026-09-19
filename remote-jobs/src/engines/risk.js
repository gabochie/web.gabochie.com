// Risk engine (§9). Flags patterns; never labels merely for being unusual.

const RISK_RULES = [
  { id: 'upfront-payment', label: 'Upfront payment required', re: /(pay|paid|fee|fund)(ing)? (to|before|upfront|first)|registration fee|application fee|startup (fee|cost)|payment required (to|before)/i, severity: 'high' },
  { id: 'pay-to-unlock', label: 'Pay to unlock tasks', re: /pay to (unlock|access|start)|buy (the|our)? (task|package|credits?)|purchase credits? (to|before)/i, severity: 'high' },
  { id: 'suspicious-crypto', label: 'Suspicious crypto deposit', re: /send us (btc|bitcoin|eth|crypto|usdt|usdc)|transfer (btc|bitcoin|crypto|usdt|usdc)/i, severity: 'high' },
  { id: 'crypto-ask', label: 'Crypto-only payment request', re: /pay (in|with) (crypto|bitcoin|usdt|usdc|shiba|dogecoin)/i, severity: 'medium' },
  { id: 'money-mule', label: 'Money mule / reshipping', re: /wallet (activation|loading)|re-?ship|reshape.? (goods|packages)|collect.? (payment|cheque|check) then|process (payments|transfers) for us/i, severity: 'high' },
  { id: 'fake-check', label: 'Fake check / overpayment', re: /overpayment|over.?pay|we (send|mail) (you )?(a )?(cheque|check)|cash (a )?(cheque|check)/i, severity: 'high' },
  { id: 'pyramid', label: 'Pyramid / MLM', re: /pyramid|multi.?level|mlm|referral (income|earnings|tree)|matrix (income|plan)/i, severity: 'high' },
  { id: 'unclear-employer', label: 'Unclear employer', re: /no (company|employer|experience) (name|provided)|undisclosed (company|client|employer)/i, severity: 'medium' },
  { id: 'telegram-whatsapp', label: 'Telegram/WhatsApp-only recruitment', re: /(join|contact|message) (us )?(on|via) (telegram|whatsapp)|telegram: ?@|whatsapp: ?@/i, severity: 'medium' },
  { id: 'unrealistic-earnings', label: 'Unrealistic earnings claim', re: /earn \$\d{4,}[+ ]?(a|per) (week|day)|make \$\d{4,}[+ ]?(a|per) (week|day) with no|guaranteed (income|earning)[^.]*\$[0-9]{3,}/i, severity: 'medium' },
  { id: 'unverified-branding', label: 'Suspicious UN/government branding', re: /official (un|united nations|world bank|government)[^.]*(agent|representative|recruiter) (needed|wanted)|we (are|work (for|with)) .{0,30}(un|united nations|world bank|bog|gra) .{0,50}(appointment|agent|representative)/i, severity: 'medium' },
  { id: 'excess-pii', label: 'Excessive personal-data request', re: /(send|provide|share) (your )?(bank (card|account|details?)|credit card|ssn|passport scan|pin|password)|upload (a copy of )?your (card|passport) (number|details?)/i, severity: 'high' },
  { id: 'dead-listing', label: 'Likely dead listing', re: /expired|closed|filled|archived|this (role|job|position) (is )?(no longer|not accepting)/i, severity: 'low' },
  { id: 'recruitment-fee', label: 'Recruitment fee', re: /recruitment (fee|charge)|agency fee (for|to)|fee (to|for) (submit|apply|candidate)/i, severity: 'high' },
];

const ALLOW_BUT_NOTE = [
  { id: 'daily-earn', label: 'High-earn claim (note, not auto-flag)', re: /\$[2-9]0\+ ?\/ ?hr|\$1,?000\+ ?\/ ?(month|week)/i },
];

export function assessRisk(title = '', description = '', source = '', company = '') {
  const text = `${title || ''} ${description || ''} ${company || ''} ${source || ''}`;
  const reasons = [];
  let maxSeverity = 0;
  for (const rule of RISK_RULES) {
    if (rule.re.test(text)) {
      reasons.push({ rule: rule.id, label: rule.label, severity: rule.severity });
      const s = rule.severity === 'high' ? 3 : rule.severity === 'medium' ? 2 : 1;
      if (s > maxSeverity) maxSeverity = s;
    }
  }
  let risk;
  switch (maxSeverity) {
    case 3: risk = 'high risk'; break;
    case 2: risk = 'needs verification'; break;
    case 1: risk = 'probably legitimate'; break;
    default: risk = 'probably legitimate';
  }
  if (reasons.length === 0) {
    risk = 'probably legitimate';
  }
  const riskScore = maxSeverity === 3 ? 90 : maxSeverity === 2 ? 60 : maxSeverity === 1 ? 35 : 10;
  return { riskScore, risk: reasons.length ? risk : 'probably legitimate', reasons };
}

export function riskScoreTo100(risk) {
  return risk.riskScore;
}