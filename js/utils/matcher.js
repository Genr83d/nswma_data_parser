import { normalizeMatchKey, normalizeZoneName, sortZones } from "./normalizer.js";

const PROTECTED_DISTRICT_TOKENS = ["east", "west", "heights", "terrace"];
const matchIndexCache = new WeakMap();

export function clearMatchIndexCache(appState) {
  if (appState) matchIndexCache.delete(appState);
}

export function flattenDistricts(appState, zoneFilter = "all") {
  const normalizedZoneFilter = zoneFilter === "all" ? "all" : normalizeZoneName(zoneFilter);
  return sortZones(appState.zones)
    .filter((zone) => normalizedZoneFilter === "all" || zone.name === normalizedZoneFilter)
    .flatMap((zone) =>
      zone.communities.flatMap((community) =>
        community.districts.flatMap((district) => {
          const districtKey = `${zone.name}|${district.name}`;
          const names = [
            district.name,
            ...(district.aliases || []),
            appState.aliases[districtKey]
          ].filter(Boolean);
          return names.map((name) => ({
            zone: zone.name,
            community: community.name,
            district: district.name,
            alias: name,
            key: `${zone.name}|${community.name}|${district.name}`
          }));
        })
      )
    );
}

function levenshteinNormalized(left, right) {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let current = new Array(right.length + 1);
  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    [previous, current] = [current, previous];
  }
  return previous[right.length];
}

export function similarity(a, b) {
  const left = normalizeMatchKey(a);
  const right = normalizeMatchKey(b);
  return similarityNormalized(left, right);
}

function similarityNormalized(left, right) {
  if (!left || !right) return 0;
  const distance = levenshteinNormalized(left, right);
  return clampSafetyScore(left, right, 1 - distance / Math.max(left.length, right.length));
}

function tokenSetNormalized(value) {
  return new Set(value.split(" ").filter(Boolean));
}

function protectedTokenMismatch(left, right) {
  const leftTokens = tokenSetNormalized(left);
  const rightTokens = tokenSetNormalized(right);
  return PROTECTED_DISTRICT_TOKENS.some((token) => leftTokens.has(token) !== rightTokens.has(token));
}

function leadingNumber(value) {
  const match = value.match(/^(\d+)/);
  return match ? match[1] : "";
}

function clampSafetyScore(left, right, score) {
  const leftNumber = leadingNumber(left);
  const rightNumber = leadingNumber(right);
  if (leftNumber && rightNumber && leftNumber !== rightNumber) return Math.min(score, 0.49);
  if (protectedTokenMismatch(left, right)) return Math.min(score, 0.67);
  return score;
}

function matchIndex(appState, zoneFilter = "all") {
  let stateCache = matchIndexCache.get(appState);
  if (!stateCache) {
    stateCache = new Map();
    matchIndexCache.set(appState, stateCache);
  }
  const normalizedZoneFilter = zoneFilter === "all" ? "all" : normalizeZoneName(zoneFilter);
  if (stateCache.has(normalizedZoneFilter)) return stateCache.get(normalizedZoneFilter);
  const candidates = flattenDistricts(appState, zoneFilter).map((candidate) => ({
    ...candidate,
    normalizedAlias: normalizeMatchKey(candidate.alias)
  }));
  const exact = new Map();
  candidates.forEach((candidate) => {
    const key = candidate.normalizedAlias;
    if (!exact.has(key)) exact.set(key, candidate);
  });
  const index = { candidates, exact, resultCache: new Map() };
  stateCache.set(normalizedZoneFilter, index);
  return index;
}

function splitCandidateSuggestions(record, candidates) {
  return (record.splitCandidates || []).map((splitCandidate) => ({
    source: splitCandidate,
    suggestions: topScoredMatches(normalizeMatchKey(splitCandidate), candidates, 4)
  }));
}

export function matchDistrict(record, appState) {
  const { candidates, exact: exactMatches, resultCache } = matchIndex(appState, record.zone || "all");
  const recordKey = normalizeMatchKey(record.district);
  const exactCandidate = exactMatches.get(recordKey);
  if (exactCandidate) {
    return {
      ...record,
      zone: exactCandidate.zone,
      community: exactCandidate.community,
      normalizedDistrict: exactCandidate.district,
      confidence: 0.98,
      status: "matched",
      suggestions: [{ ...exactCandidate, score: 0.98 }],
      splitCandidateSuggestions: []
    };
  }

  const cached = resultCache.get(recordKey);
  if (cached) return applyCachedMatch(record, cached, candidates);

  const fuzzyMatches = topScoredMatches(recordKey, candidates, 4);
  const best = fuzzyMatches[0];
  const secondBest = fuzzyMatches[1];
  const clearWinner = best && (!secondBest || best.score - secondBest.score >= 0.08);
  if (best && best.score >= 0.85 && clearWinner) {
    const cachedMatch = {
      type: "matched",
      zone: best.zone,
      community: best.community,
      normalizedDistrict: best.district,
      confidence: parseFloat((best.score * 0.95).toFixed(2)),
      status: "matched",
      suggestions: fuzzyMatches.slice(0, 4),
      splitCandidateSuggestions: []
    };
    resultCache.set(recordKey, cachedMatch);
    return applyCachedMatch(record, cachedMatch, candidates);
  }

  const cachedMiss = {
    type: "unmapped",
    community: null,
    normalizedDistrict: null,
    confidence: 0.25,
    status: "unmapped",
    notes: "Parsed district not found in selected zone master list",
    suggestions: fuzzyMatches.slice(0, 4),
    splitCandidateSuggestions: splitCandidateSuggestions(record, candidates)
  };
  resultCache.set(recordKey, cachedMiss);
  return applyCachedMatch(record, cachedMiss, candidates);
}

function topScoredMatches(recordKey, candidates, limit) {
  const top = [];
  candidates.forEach((candidate) => {
    const score = similarityNormalized(recordKey, candidate.normalizedAlias);
    const scored = { ...candidate, score };
    const insertAt = top.findIndex((item) => score > item.score);
    if (insertAt === -1) {
      if (top.length < limit) top.push(scored);
      return;
    }
    top.splice(insertAt, 0, scored);
    if (top.length > limit) top.pop();
  });
  return top;
}

function applyCachedMatch(record, cached, candidates) {
  const { type, ...cachedRecordFields } = cached;
  if (type !== "unmapped") return { ...record, ...cachedRecordFields };
  return {
    ...record,
    ...cachedRecordFields,
    splitCandidateSuggestions: splitCandidateSuggestions(record, candidates)
  };
}

export function uniqueDistrictTargets(appState) {
  const seen = new Set();
  return flattenDistricts(appState, "all").filter((item) => {
    const key = `${item.zone}|${item.community}|${item.district}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
