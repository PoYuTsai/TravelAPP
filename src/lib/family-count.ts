const DEFAULT_FAMILY_COUNT = 114

export function normalizeFamilyCount(count?: number) {
  if (!Number.isFinite(count) || typeof count !== 'number' || count <= 0) {
    return DEFAULT_FAMILY_COUNT
  }

  return Math.floor(count)
}

export function formatFamilyCountLabel(count?: number) {
  return `${normalizeFamilyCount(count)}+`
}
