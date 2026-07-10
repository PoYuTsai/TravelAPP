export const HOMEPAGE_ENTITY_SENTENCE =
  '清微旅行 Chiangway Travel 是爸媽開的清邁親子包車品牌，由台灣爸爸 Eric 與泰國媽媽 Min 經營；標準泰國司機、行程事先確認與 LINE 中文支援，中文導遊依需求選配。'

export const CAR_CHARTER_ENTITY_SENTENCE =
  '清微旅行是爸媽開的清邁親子包車，由 Eric 與 Min 在地經營；標準泰國司機、LINE 中文支援與中文導遊選配，兒童安全座椅付費加購。'

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
