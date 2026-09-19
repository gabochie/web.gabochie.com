// Search query generation from the skill graph (§28) — dynamic, not static.

import { defaultSkills } from '../data/skills.js';
import { defaultQueries } from '../data/seed_sources.js';

const SARAS = ['remote', 'international', 'online', 'global', 'freelance', 'contract', 'consultant'];
const CONTEXTS = ['work from Ghana', 'opportunities from Ghana', 'paid', 'hire', 'recruiting'];

export function generateQueries(skills = defaultSkills) {
  const queries = new Set();
  const active = skills.filter((s) => (s.level || 0) >= 2);
  const seed = active
    .sort((a, b) => b.level - a.level)
    .slice(0, 12)
    .map((s) => s.name);
  for (const sk of seed) {
    queries.add(`${sk} remote`);
    queries.add(`remote ${sk} jobs`);
    queries.add(`hire ${sk} freelancer`);
    queries.add(`${sk} contract work`);
    queries.add(`${sk} opportunities from Ghana`);
  }
  for (const q of defaultQueries) queries.add(q);
  for (const saras of SARAS.slice(0, 3)) {
    for (const s of seed.slice(0, 5)) {
      queries.add(`${saras} ${s} consultant`);
    }
  }
  return [...queries];
}