// Application assistant (§14). Rule-based generation; never auto-submits.

import { all, row } from '../db.js';
import { loadWeights } from '../engine_utils.js';

const STAGES = ['discovered', 'reviewed', 'shortlisted', 'preparing', 'applied', 'interview', 'offer', 'won', 'paid', 'lost', 'rejected'];

export const stageLabels = {
  discovered: 'Discovered',
  reviewed: 'Reviewed',
  shortlisted: 'Shortlisted',
  preparing: 'Preparing',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  won: 'Won',
  paid: 'Paid',
  lost: 'Lost',
  rejected: 'Rejected',
};

function daysFromNow(n) {
  const d = new Date(Date.now() + n * 86400000);
  return d.toISOString().slice(0, 10);
}

function skillsFrom(opp) {
  if (Array.isArray(opp.skills)) return opp.skills;
  try { return JSON.parse(opp.skills || '[]'); } catch { return []; }
}

function paymentChannels(opp) {
  if (opp.ghana_payment_compat && typeof opp.ghana_payment_compat === 'object') return opp.ghana_payment_compat;
  try { return JSON.parse(opp.ghana_payment_compat || '{}'); } catch { return {}; }
}

export function buildApplicationPlan(opp) {
  const sk = skillsFrom(opp);
  const pay = paymentChannels(opp);
  const skillsText = sk.length ? sk.map((s) => `${s.name} (${s.category})`).join(', ') : 'general professional skills';
  const payText = pay.channels && pay.channels.length ? pay.channels[0] : 'confirm payment method with employer';

  const whyMatch = `You match this because of: ${skillsText}. Your documentation/research background and ability to work from Accra (GMT, same timezone as the UK) make you a strong candidate.`;

  const checklist = [
    'Open the original listing and read the full requirements.',
    'Confirm Ghana eligibility in the posting; if unclear, message the contact person politely.',
    'Update CV/resume to highlight the specific skills above, with results.',
    'Prepare the portfolio evidence listed below.',
    `Confirm your payment rail before interviewing: ${payText}.`,
    `Submit before ${opp.deadline || 'the deadline'}; set a reminder.`,
  ];

  const portfolio = all('SELECT * FROM portfolio');
  const recommendedPortfolio = portfolio
    .filter((p) => sk.some((s) => (JSON.parse(p.skills || '[]') || []).includes(s.id)))
    .slice(0, 3)
    .map((p) => p.title);

  const proposal = [
    `Dear ${(opp.company || 'the team').replace(/—/g, '').trim()},`,
    '',
    `I read the listing for "${opp.title}" and believe I am a strong fit. My strongest relevant capabilities are ${skillsText}${opp.company ? `, and I know the value of professional delivery for ${opp.company}` : ''}.`,
    '',
    'I combine professional depth with reliable remote execution: I work from Accra, Ghana (UTC+0), which overlaps well with UK and European working hours, and I have a working payment route (Payoneer/Deel or direct bank transfer) so onboarding is straightforward.',
    '',
    'I would welcome the chance to show how I solve this specific problem. I can start with '
      + (opp.application_effort <= 2 ? 'little preparation' : 'a short sample/case study relevant to this role.')
      + ' May I schedule a short call?',
    '',
    'Best regards,',
    'Professional (portfolio available on request)',
  ].join('\n');

  const questionsToPrepare = [
    `Why are you interested in ${opp.title}?`,
    'What is your relevant experience for this specific requirement?',
    'How do you manage communication across time zones?',
    'How do you prefer payments to be structured (via Payoneer/Deel vs invoice/transfer)?',
  ];

  const followUp = daysFromNow(opp.application_effort <= 2 ? 2 : 5);

  return {
    whyMatch,
    missing: [],
    checklist,
    portfolioRecommendations: recommendedPortfolio,
    proposal,
    coverLetter: proposal, // same core text is fine as cover letter
    questionsToPrepare,
    pricingSuggestion: opp.opp_type === 'freelance' || opp.opp_type === 'consulting'
      ? 'Benchmark: $30-60/hr for direct contracts; $60-150/hr for consulting/expert work. Anchor on value, not hourly—quotes for projects when possible.'
      : 'Not applicable (salaried/paid on platform terms)',
    followUpDate: followUp,
    paymentRoute: payText,
  };
}

export function pipelineCounts() {
  return all('SELECT stage, COUNT(*) c FROM applications GROUP BY stage');
}

export function applicationsWithOpportunities() {
  return all(
    `SELECT a.*, o.title, o.company, o.estimated_usd, o.match_score, o.source, o.url
     FROM applications a JOIN opportunities o ON o.id = a.opportunity_id
     ORDER BY a.updated_at DESC`,
  );
}