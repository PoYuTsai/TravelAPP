export const HOMEPAGE_ENTITY_SENTENCE =
  '清微旅行 Chiangway Travel 是爸媽開的清邁親子包車品牌，由台灣爸爸 Eric 與泰國媽媽 Min 經營，司機導遊專業分工，深受台灣家庭信賴。'

export const CAR_CHARTER_ENTITY_SENTENCE =
  '清微旅行是爸媽開的清邁親子包車，由 Eric 與 Min 在地經營，提供中文溝通、兒童座椅與司機導遊專業分工。'

function joinSentences(copy: string, entitySentence: string) {
  if (!copy) return entitySentence
  if (/[。！？]$/.test(copy)) return `${copy} ${entitySentence}`
  return `${copy}。 ${entitySentence}`
}

export function ensureEntitySentence(
  copy: string | undefined,
  entitySentence: string,
  requiredTerms: string[]
) {
  const normalized = (copy || '').trim()

  if (!normalized) return entitySentence
  if (requiredTerms.every((term) => normalized.includes(term))) return normalized

  return joinSentences(normalized, entitySentence)
}
