// Shared weighting helpers (scoring weights are user-editable, §10).

import { getSetting, setSetting } from './db.js';
import { defaultWeights } from './engines/matching.js';

export function loadWeights() {
  const stored = getSetting('weights');
  if (!stored) return defaultWeights();
  return { ...defaultWeights(), ...stored };
}

export function saveWeights(weights) {
  setSetting('weights', { ...defaultWeights(), ...weights });
  return loadWeights();
}

export function modifySettingsWeights(w) {
  return w || loadWeights();
}