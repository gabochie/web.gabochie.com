// Payment engine (§4, §18): maps an opportunity's likely payment rails to Ghana-compatible routes.

import { defaultPaymentProviders } from '../data/seed_payments.js';

const MARKET_PAYERS = {
  upwork: ['payoneer', 'raenest', 'swift-bank'],
  fiverr: ['payoneer', 'raenest', 'swift-bank'],
  remote_employment: ['deel', 'remote', 'payoneer', 'swift-bank'],
  freelance_direct: ['paypal-out', 'wise-send', 'paystack', 'flutterwave', 'swift-bank', 'deel'],
  ai_platform: ['payoneer', 'swift-bank', 'deel', 'remote'],
  expert_network: ['swift-bank', 'deel', 'remote'],
  grants: ['swift-bank'],
  marketplace_digital: ['paystack', 'flutterwave', 'deel', 'payoneer'],
};

export function scoreOpportunityPayment(opp) {
  const text = `${opp.source || ''} ${opp.title || ''} ${opp.company || ''}`.toLowerCase();
  let railKey = 'freelance_direct';
  if (/upwork/i.test(text)) railKey = 'upwork';
  else if (/fiverr/i.test(text)) railKey = 'fiverr';
  else if (/deel/i.test(text)) railKey = 'remote_employment';
  else if (/outlier|alignerr|mercor|turing|crowdgen|datannotation|dataforce|lxt|welocalize/i.test(text)) railKey = 'ai_platform';
  else if (/glg|guidepoint|alphasights|third bridge|dialectica|expert network/i.test(text)) railKey = 'expert_network';
  else if (/grant|fellowship|fund|foundation/i.test(text)) railKey = 'grants';
  else if (/paystack|checkout|digital product|marketplace|template|plugin/i.test(text)) railKey = 'marketplace_digital';
  else if (/remote\.com|remote.com|job|employment|full.?time|contract/i.test(text)) railKey = 'remote_employment';

  const providerIds = MARKET_PAYERS[railKey] || MARKET_PAYERS.freelance_direct;
  const providers = defaultPaymentProviders.filter((p) => providerIds.includes(p.id));
  const verified = providers.filter((p) => p.status === 'verified');
  const unverified = providers.filter((p) => p.status !== 'verified');

  const routes = [];
  const compat = new Map();
  for (const p of [...verified, ...unverified]) {
    compat.set(p.name, p.status === 'verified' ? 100 : 50);
    routes.push({
      provider: p.name,
      status: p.status,
      role: 'receive',
      withdraw_bank: p.withdraw_bank,
      mobile_money: p.mobile_money,
      fees: p.fees,
      verified_date: p.verified_date,
      source: p.source,
    });
  }

  const score = Math.min(100, verified.length * 30 + 10);

  return {
    score,
    rail: railKey,
    summary: `Best rails: ${verified.map((p) => p.name).join(', ') || 'none verified yet'}. Unverified candidates: ${unverified.map((p) => p.name).join(', ') || 'none'}.`,
    routes,
    channels: [
      'Employer → Payoneer → Ghana bank (GHS) or MoMo P2P',
      'Employer (via Deel/Remote) → Stripe Connect/Wise → Ghana bank',
      'Client → Paystack/Flutterwave checkout → Ghana bank or MoMo',
      'Client → SWIFT wire → Ghana FX account (GCB/Ecobank/Absa)',
    ],
    note: 'Verified 2026-09-19. PayPal (receive) and direct Stripe are NOT available to Ghana residents. Wise is send-to only. Re-verify before relying.',
  };
}