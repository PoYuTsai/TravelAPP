/**
 * partner-aliases.ts — known operating partners of the partner group (Eric
 * 2026-06-07).
 *
 * The bot must recognise these LINE display names as OPERATING PARTNERS (the
 * primary customer-facing window), never as customers. This is identity context
 * only — it does NOT decide replies or sends, and it does NOT auto-@-tag anyone.
 *
 * @-tagging restraint (Eric 2026-06-07): a future feature may @-tag a partner,
 * but ONLY when a specific partner must supply info / take an action / is named.
 * Drafts must NOT auto-tag Lulu/Chun on every message — that makes the group noisy.
 */

export interface PartnerAlias {
  /** How Eric refers to the partner. */
  canonical: string
  /** Known LINE display names that map to this partner (loose, may evolve). */
  displayNames: string[]
}

export const PARTNER_ALIASES: PartnerAlias[] = [
  { canonical: 'Lulu', displayNames: ['宜 如果 乾', '宜如果乾'] },
  { canonical: '彥均', displayNames: ['Chun'] },
]

/** Trim, collapse inner whitespace, and lowercase (Latin) for tolerant matching. */
function normalize(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export interface ResolvedPartner {
  canonical: string
  isOperatingPartner: true
}

/**
 * Resolve a LINE display name to a known operating partner, or null when the name
 * is not a known partner (i.e. treat as a customer / non-partner).
 */
export function resolvePartnerAlias(displayName: string): ResolvedPartner | null {
  if (!displayName) return null
  const target = normalize(displayName)
  for (const partner of PARTNER_ALIASES) {
    if (partner.displayNames.some((d) => normalize(d) === target)) {
      return { canonical: partner.canonical, isOperatingPartner: true }
    }
  }
  return null
}

/** True iff the display name belongs to a known operating partner. */
export function isOperatingPartner(displayName: string): boolean {
  return resolvePartnerAlias(displayName) !== null
}
