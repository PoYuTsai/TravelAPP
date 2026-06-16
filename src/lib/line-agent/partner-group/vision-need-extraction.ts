/**
 * vision-need-extraction.ts — 圖片智慧回覆刀的「語義抽 need」層。
 *
 * 取代 vision-intake-adapter 的「純轉錄」：把截圖讀成結構化 need（語義摘要 +
 * 已知事實 + 缺漏），餵給下游 agentic smart-reply 迴圈。fail-closed 紀律：
 * model 回的不是合法 JSON ⇒ 把原文當 summary（永不丟掉抽取、永不 throw）。
 */

export interface VisionNeedBrief {
  /** false ⇒ 非對話截圖（風景/地圖）⇒ 上游回固定誠實句、不進 agentic 迴圈。 */
  isConversation: boolean
  /** 客人需求/問題的語義摘要（繁中、可含開放問題，不只排行程）。 */
  summary: string
  /** 圖中明確提供的事實（日期/人數/年齡/偏好…）。 */
  knownFacts: string[]
  /** 排行程/報價常需、但圖中沒提到的（航班/住宿/上車點…）。 */
  gaps: string[]
}

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

/** Fail-closed parse：壞 JSON ⇒ 原文當 summary、其餘空。永不 throw。 */
export function parseVisionNeedBrief(raw: string): VisionNeedBrief {
  const text = raw.trim()
  try {
    // model 偶爾包 ```json fence；剝掉再 parse。
    const stripped = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const obj = JSON.parse(stripped) as Record<string, unknown>
    const summary = typeof obj.summary === 'string' && obj.summary.trim() !== '' ? obj.summary : text
    return {
      isConversation: obj.isConversation !== false, // 預設視為對話（缺欄位也照走）
      summary,
      knownFacts: asStringArray(obj.knownFacts),
      gaps: asStringArray(obj.gaps),
    }
  } catch {
    return { isConversation: true, summary: text, knownFacts: [], gaps: [] }
  }
}
