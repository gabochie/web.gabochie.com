// Shared weighting helpers (scoring weights are user-editable, §10).

import { getSetting, setSetting } from './db.js';
import { defaultWeights } from './engines/matching.js';

export async function loadWeights() {
  const stored = await getSetting('weights');
  if (!stored) return defaultWeights();
  return { ...defaultWeights(), ...stored };
}

export async function saveWeights(weights) {
  await setSetting('weights', { ...defaultWeights(), ...weights });
  return loadWeights();
}

export async function modifySettingsWeights(w) {
  return w || loadWeights();
}