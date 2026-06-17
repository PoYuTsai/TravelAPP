/**
 * vision-need-extraction.ts — 圖片智慧回覆刀的「語義抽 need」層。
 *
 * 取代 vision-intake-adapter 的「純轉錄」：把截圖讀成結構化 need（語義摘要 +
 * 已知事實 + 缺漏），餵給下游 agentic smart-reply 迴圈。fail-closed 紀律：
 * model 回的不是合法 JSON ⇒ 把原文當 summary（永不丟掉抽取、永不 throw）。
 */

import type { LineImageContent } from '../line/content-client'
import type { DailyCostCap } from '../observability/daily-cost-cap'
import type { AgentLogger } from '../observability/structured-log'
import { createAnthropicVisionIntakeSource } from './vision-intake-adapter'

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

/** 語義抽取 max_tokens：JSON brief 比純轉錄短。 */
const NEED_EXTRACTION_MAX_TOKENS = 700

export const VISION_NEED_SYSTEM_INSTRUCTION = [
  '你是清邁包車旅行社的內部助手。輸入是一張 LINE 對話截圖（客人與夥伴的對話）。',
  '任務：讀懂「客人方」表達的需求或問題，輸出一個 JSON 物件，供後續助手查資料與回覆。',
  '只輸出 JSON，不要任何前綴、後綴、markdown fence 或說明。JSON 欄位：',
  '- isConversation (boolean)：是否為客人對話截圖。若是風景照/地圖/非對話 ⇒ false，其餘欄位給空。',
  '- summary (string)：用繁體中文一句話講清楚客人想要什麼或在問什麼（可以是開放問題，不限排行程）。',
  '- knownFacts (string[])：截圖中**實際出現**的關鍵事實（日期、天數、人數、小孩年齡、偏好、預算…），照原文寫。',
  '  · 日期一律照截圖數字原樣記，斜線格式 M/D 視為「月/日」，不得把 7/1-7/5 解讀成跨月或跨年；',
  '    同月日期區間照原文格式原樣保留（如 7/1-7/5），不得改寫成跨月/跨年表述、也不要自行加算天數。',
  '- gaps (string[])：排行程或報價常需要、但這張圖**沒有提到**的資訊（航班、住宿區域、上車點…）。圖裡已寫的不要列。',
  '硬規則：只根據截圖內容；不得腦補、不要猜沒寫出來的資訊；不得提價格或做任何承諾。',
].join('\n')

const NEED_EXTRACTION_USER_TEXT = '請讀懂這張截圖並輸出 need JSON。'

export interface VisionNeedSourceDeps {
  transport: typeof fetch
  apiKey: string
  costCap: DailyCostCap
  model?: string
  env?: Record<string, string | undefined>
  log?: AgentLogger
}

export type VisionNeedSource = (image: LineImageContent) => Promise<VisionNeedBrief>

/** 複用 vision-intake-adapter 的 transport/cost-cap 機制，只換 prompt + parse。 */
export function createAnthropicVisionNeedSource(deps: VisionNeedSourceDeps): VisionNeedSource {
  const raw = createAnthropicVisionIntakeSource({
    transport: deps.transport,
    apiKey: deps.apiKey,
    costCap: deps.costCap,
    model: deps.model,
    env: deps.env,
    log: deps.log,
    systemInstruction: VISION_NEED_SYSTEM_INSTRUCTION,
    userText: NEED_EXTRACTION_USER_TEXT,
    maxTokens: NEED_EXTRACTION_MAX_TOKENS,
  })
  return async (image) => parseVisionNeedBrief(await raw(image))
}
