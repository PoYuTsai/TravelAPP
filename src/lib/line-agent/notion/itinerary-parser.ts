/**
 * Deterministic 行程框架 → area/theme hint parser (v1).
 *
 * Pure, synchronous, network-free, NO LLM. The real private_2026 corpus has no
 * explicit 城市區域 / 行程類型 column; the area/theme signal lives inside the
 * free-text 行程框架. This module lifts that signal with a STRICT WHITELIST
 * alias table so the result is reproducible and never hallucinated:
 *
 *   - only Chinese tokens listed below resolve to a canonical snake_case hint;
 *   - matching is longest-alias-first with span consumption, so a compound term
 *     (夜間動物園 → night_safari) is never also counted as its substring
 *     (動物園) should a shorter alias ever be added;
 *   - unrecognised text contributes nothing — area/theme stay empty rather than
 *     being invented (Eric's「不亂補」rule).
 *
 * Output order follows first appearance in the text (then the index layer
 * normalises/sorts again), so the contract is stable end-to-end.
 *
 * Extend ALIAS tables only — keep matching logic and the contract intact.
 */

export interface ItineraryHints {
  areaHints: string[]
  themeHints: string[]
}

// Chinese place token → canonical area hint. Half/full-width variants share a token.
const AREA_ALIASES: Record<string, string> = {
  清邁: 'chiangmai',
  清萊: 'chiangrai',
  芳縣: 'fang',
  芳县: 'fang',
  茵他儂: 'inthanon',
  湄康蓬: 'mae_kampong',
  南邦: 'lampang',
  南奔: 'lamphun',
}

// Activity token → canonical theme hint. Longest aliases win first, so a
// compound (夜間動物園) is consumed before its substring (動物園) can re-match.
// English/named-operator aliases are matched case-sensitively as written — the
// private_2026 行程框架 corpus uses these exact spellings.
const THEME_ALIASES: Record<string, string> = {
  // night safari MUST precede the bare 動物園 zoo alias (longest-first).
  夜間動物園: 'night_safari',
  動物園: 'zoo',
  大象: 'elephant',
  // zipline — generic 飛索 head + named operators
  叢林飛索: 'zipline',
  飛索: 'zipline',
  'Jungle Flight': 'zipline',
  Pongyang: 'zipline',
  Kingkong: 'zipline',
  // cafe
  咖啡廳: 'cafe',
  咖啡: 'cafe',
  cafe: 'cafe',
  // temple — generic 寺/廟 head nouns cover 藍廟/白廟/柴迪隆寺/帕辛寺
  寺: 'temple',
  廟: 'temple',
  // market — generic 市集/夜市 head nouns + named market 瓦洛洛
  市集: 'market',
  夜市: 'market',
  瓦洛洛: 'market',
  // massage
  按摩: 'massage',
  // photo
  泰服: 'photo',
  拍照: 'photo',
  攝影: 'photo',
  網美: 'photo',
  // shopping
  'Big C': 'shopping',
  採買: 'shopping',
  伴手禮: 'shopping',
  // adventure
  'Phoenix Adventure': 'adventure',
  冒險: 'adventure',
  越野: 'adventure',
  ATV: 'adventure',
}

/**
 * Extract canonical tokens for one category. Aliases are tried longest-first and
 * each matched span is blanked (same-length spaces, so indices stay valid) so a
 * shorter overlapping alias cannot re-match the consumed region. Tokens are
 * de-duplicated and returned in order of first appearance in the text.
 */
function extract(text: string, aliases: Record<string, string>): string[] {
  let working = text
  const longestFirst = Object.keys(aliases).sort((a, b) => b.length - a.length)
  const found: Array<{ token: string; pos: number }> = []
  const seen = new Set<string>()

  for (const alias of longestFirst) {
    const firstPos = working.indexOf(alias)
    if (firstPos === -1) continue

    // Consume every occurrence so overlapping shorter aliases skip this span.
    let pos = firstPos
    while (pos !== -1) {
      working = working.slice(0, pos) + ' '.repeat(alias.length) + working.slice(pos + alias.length)
      pos = working.indexOf(alias)
    }

    const token = aliases[alias]
    if (seen.has(token)) continue
    seen.add(token)
    found.push({ token, pos: firstPos })
  }

  return found.sort((a, b) => a.pos - b.pos).map((f) => f.token)
}

/** Parse 行程框架 free text into deterministic area/theme hints. */
export function parseItineraryHints(text: string): ItineraryHints {
  if (!text || text.trim().length === 0) {
    return { areaHints: [], themeHints: [] }
  }
  return {
    areaHints: extract(text, AREA_ALIASES),
    themeHints: extract(text, THEME_ALIASES),
  }
}
