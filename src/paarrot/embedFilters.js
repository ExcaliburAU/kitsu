const { AccountData, StateEvent } = require('./constants');

const EMPTY = Object.freeze({ disabledPatterns: [] });

/** @type {Map<string, RegExp|null>} */
const regexCache = new Map();
const REGEX_CACHE_MAX = 64;

function normalizePatterns(content) {
  const patterns = content?.disabledPatterns;
  return {
    disabledPatterns: Array.isArray(patterns)
      ? patterns.filter((p) => typeof p === 'string' && p.length > 0)
      : [],
  };
}

function combineEmbedFilters(personal, roomWide) {
  const set = new Set([
    ...(personal?.disabledPatterns || []),
    ...(roomWide?.disabledPatterns || []),
  ]);
  return [...set];
}

function compiledPattern(pattern) {
  if (regexCache.has(pattern)) return regexCache.get(pattern);
  let re = null;
  try {
    re = new RegExp(pattern, 'i');
  } catch {
    re = null;
  }
  if (regexCache.size >= REGEX_CACHE_MAX) {
    const first = regexCache.keys().next().value;
    regexCache.delete(first);
  }
  regexCache.set(pattern, re);
  return re;
}

function isUrlEmbedDisabled(url, disabledPatterns) {
  if (!url || !disabledPatterns?.length) return false;
  return disabledPatterns.some((pattern) => {
    const re = compiledPattern(pattern);
    return Boolean(re && re.test(url));
  });
}

function getPersonalEmbedFilters(room) {
  if (!room?.getAccountData) return { ...EMPTY };
  const event = room.getAccountData(AccountData.EmbedFilters);
  if (!event) return { ...EMPTY };
  return normalizePatterns(event.getContent?.() || {});
}

function getRoomWideEmbedFilters(room) {
  if (!room?.currentState?.getStateEvents) return { ...EMPTY };
  const event = room.currentState.getStateEvents(StateEvent.RoomEmbedFilters, '');
  if (!event) return { ...EMPTY };
  return normalizePatterns(event.getContent?.() || {});
}

function getCombinedEmbedPatterns(room) {
  return combineEmbedFilters(getPersonalEmbedFilters(room), getRoomWideEmbedFilters(room));
}

module.exports = {
  AccountData,
  StateEvent,
  EMPTY,
  normalizePatterns,
  combineEmbedFilters,
  isUrlEmbedDisabled,
  getPersonalEmbedFilters,
  getRoomWideEmbedFilters,
  getCombinedEmbedPatterns,
};
