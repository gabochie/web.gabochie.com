// Ghana-first accessibility (§3). Rules only; never invents eligibility.

const RESTRICTED_REGIONS = {
  'us only': /us only|usa only|united states only|u\.s\. only|based in the (us|usa|u\.s\.)/i,
  'eu only': /eu only|europe only|european union only|based in the eu|18\+\s*(european\s*)?union/i,
  'uk only': /uk only|united kingdom only|based in the uk|britain only/i,
  'ca only': /canada only|based in canada/i,
  'au/nz only': /australia only|new zealand only|australia or new zealand/i,
};

const NEGATIVE_WORDS = [
  /residents? of the united states only/i,
  /must be (based in|located in|reside in) (the )?(us|usa|united states|eu|europe|uk|united kingdom|canada|australia|new zealand)/i,
  /only (open to|available to) (us|usa|american|european|uk|british|canadian|australian)/i,
  /excluding africa/i,
  /not available in (africa|ghana|west africa)/i,
  /applicants (from|in) (africa|ghana|west africa) (will|are|need not|should not)/i,
  /no (applications|candidates) from africa/i,
];

const POSITIVE_WORDS = [
  /worldwide/i,
  /anywhere in the world/i,
  /global(ly)?( -)? remote/i,
  /open to (all|any) (nationalities|candidates|applicants)/i,
  /no (geo|geographic|location|country) (restriction|requirements?)/i,
  /work from anywhere/i,
  /remote (within|in) (africa|ghana)/i,
  /africa( -)? wide/i,
  /ghanail|ghana (residents?|citizens?|based|nationals?)/i,
  /for africans/i,
];

export function detectGeoEligibility(text) {
  const t = String(text || '');
  if (!t) return { geo: 'Unknown', ghana: null, evidence: [] };

  const evidence = [];
  let ghana = null; // null = unknown, true = eligible, false = not eligible
  let geo = 'Unknown';

  // Explicit negative first (strongest signal).
  for (const re of NEGATIVE_WORDS) {
    if (re.test(t)) { geo = 'Country-restricted'; ghana = false; evidence.push(`Negative rule: ${re.source}`); break; }
  }

  // Region-restricted labels.
  if (ghana !== false) {
    for (const [label, re] of Object.entries(RESTRICTED_REGIONS)) {
      if (re.test(t)) { geo = label; ghana = false; evidence.push(`Restricted to: ${label}`); break; }
    }
  }

  // Positive signals override only when no strong negative matched.
  if (ghana !== false) {
    for (const re of POSITIVE_WORDS) {
      if (re.test(t)) {
        if (geo === 'Unknown') geo = 'Worldwide';
        ghana = true;
        evidence.push(`Positive rule: ${re.source}`);
      }
    }
  }

  // Ghana explicit mention
  if (/ghana/i.test(t)) {
    evidence.push('Mentions Ghana');
    if (ghana === null || ghana === false) {
      // If it mentions Ghana but only in a negative pattern we may still be unsure.
      if (!/(excluding|except|not|no|outside) .*ghana/i.test(t)) ghana = true;
    }
  }

  if (ghana === null) geo = evidence.length ? 'Unknown' : 'Unknown';
  return { geo, ghana, evidence };
}

// Returns a score 0-100 for Ghana accessibility of a raw listing.
export function ghanaAccessibilityScore(listing) {
  const { geo, ghana } = detectGeoEligibility(listing.title + ' ' + listing.description);
  if (ghana === true) return 100;
  if (ghana === false) return 0;
  if (/worldwide|global|anywhere|any location/i.test(listing.title + ' ' + (listing.country || ''))) return 85;
  if (/africa|african/i.test(listing.country || '')) return 80;
  return 40; // unknown -> needs verification, do not assume
}