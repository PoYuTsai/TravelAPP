/**
 * vision-intake-adapter.ts — 圖片刀B 的真 Anthropic vision adapter.
 *
 * 角色分工（mirror case-intake-llm-adapter）：
 *   - 本模組只負責「把 LINE 圖片變成 Anthropic image block、把回應變成抽取
 *     文字」；圖片來源（LINE content API）與下游三分流都在 surfacing 模組。
 *   - transport 注入（fetch-shaped）— 不 import SDK，測試注入 fake。
 *   - COST CAP 紀律：呼叫前 checkBudget，非 `ok` 一律不打、throw fixed-code
 *     error；呼叫後 recordSpend，記帳失敗永不丟掉已付費的回覆。
 *
 * Prompt 誠實邊界：vision 只「轉錄」截圖中實際出現的客人文字，不得腦補、
 * 不得提價格；看不清楚要標註（無法辨識）。錯誤一律 fixed code，永不帶
 * key / 圖片內容 / 模型回應。
 *
 * Prompt 可由呼叫端 override（沉澱刀1 全文轉錄用），預設仍是刀B 客需抽取。
 */

import type { LineImageContent } from '../line/content-client'
import { type DailyCostCap } from '../observability/daily-cost-cap'
import { createAgentLogger, type AgentLogger } from '../observability/structured-log'
import { callAnthropicMessages } from '../observability/anthropic-call'

/** 抽取輸出是一段對話轉錄 — 不需要長文。 */
const EXTRACTION_MAX_TOKENS = 1024

/**
 * Usage 缺漏時的保守 input token 估計：一張 LINE 截圖約 1.x 百萬像素
 * ≈ 1500–1600 vision tokens；取 2000 寧可高估（絕不記 0）。
 */
const FALLBACK_IMAGE_INPUT_TOKENS = 2000

// ---------------------------------------------------------------------------
// Model resolution（explicit > env > default；Haiku 看截圖已足夠）
// ---------------------------------------------------------------------------

export const VISION_INTAKE_MODEL_DEFAULT = 'claude-haiku-4-5'

export function resolveVisionIntakeModel(opts?: {
  model?: string
  env?: Record<string, string | undefined>
}): string {
  const explicit = opts?.model?.trim()
  if (explicit) return explicit
  const fromEnv = opts?.env?.AI_AGENT_VISION_INTAKE_MODEL?.trim()
  if (fromEnv) return fromEnv
  return VISION_INTAKE_MODEL_DEFAULT
}

// ---------------------------------------------------------------------------
// Extraction prompt（pure constant, exported for the tripwire test）
// ---------------------------------------------------------------------------

export const VISION_EXTRACTION_SYSTEM_INSTRUCTION = [
  '你是清邁包車旅行社的內部助手。輸入是一張 LINE 對話截圖，內容是客人與夥伴的對話。',
  '任務：把「客人方」表達的需求內容，整理成繁體中文純文字，供後續客需整理使用。',
  '硬規則：',
  '- 只整理截圖中實際出現的文字；不得腦補、不得推測沒寫出來的資訊',
  '- 看不清楚或被截斷的部分，標註（無法辨識），不要猜',
  '- 保留人數、日期、天數、航班、住宿、預算等關鍵資訊的原始寫法',
  '- 不得提到價格建議、不得做任何承諾、不得加入你自己的評論',
  '- 若截圖不是對話（風景照、地圖等），只回一句：這張圖不是客人對話截圖',
  '只輸出整理後的純文字，不要任何前綴、後綴或說明。',
].join('\n')

export const EXTRACTION_USER_TEXT = '請整理這張截圖中客人表達的需求。'

// ---------------------------------------------------------------------------
// Source factory — transport + cost cap；錯誤一律 fixed code
// ---------------------------------------------------------------------------

/** 抽取截圖文字的注入點：surfacing 模組只依賴這個函式型別。 */
export type VisionIntakeSource = (image: LineImageContent) => Promise<string>

/** Fixed-code、secret-free 的 vision adapter 錯誤。 */
export class VisionIntakeError extends Error {
  constructor(code: string) {
    super(`vision intake call failed: ${code}`)
    this.name = 'VisionIntakeError'
  }
}

export interface AnthropicVisionIntakeSourceDeps {
  /** fetch-shaped transport（tests 注入 fake；prod 注入 fetch）。 */
  transport: typeof fetch
  apiKey: string
  /** REQUIRED — 忘了接 cap 永遠不能等於無上限燒錢。 */
  costCap: DailyCostCap
  model?: string
  env?: Record<string, string | undefined>
  log?: AgentLogger
  /**
   * 可選 system instruction override（沉澱刀1 的全文轉錄 prompt 用）。
   * 省略 ⇒ 既有 VISION_EXTRACTION_SYSTEM_INSTRUCTION（圖片刀B 行為不變）。
   */
  systemInstruction?: string
  /** 可選 user text override — 同上。 */
  userText?: string
  /**
   * 可選 max_tokens override（全文轉錄比客需抽取長，沉澱刀1 接線時調高）。
   * 省略 ⇒ 既有 EXTRACTION_MAX_TOKENS（圖片刀B 行為不變）。
   */
  maxTokens?: number
}

export function createAnthropicVisionIntakeSource(
  deps: AnthropicVisionIntakeSourceDeps
): VisionIntakeSource {
  const model = resolveVisionIntakeModel({ model: deps.model, env: deps.env })
  const log = deps.log ?? createAgentLogger({ requestId: '-' })
  const systemInstruction =
    deps.systemInstruction ?? VISION_EXTRACTION_SYSTEM_INSTRUCTION
  const userText = deps.userText ?? EXTRACTION_USER_TEXT
  const maxTokens = deps.maxTokens ?? EXTRACTION_MAX_TOKENS

  return async function extract(image: LineImageContent): Promise<string> {
    // transport / cost cap / parse / record / 截斷='mark'（截斷只標記不致命，
    // 部分文字仍有價值照樣回）全在共用 callAnthropicMessages；本層只組 image
    // block 並把 fixed code 映射成 VisionIntakeError。
    const { text } = await callAnthropicMessages(
      {
        model,
        system: systemInstruction,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: image.mediaType,
                  data: image.base64,
                },
              },
              { type: 'text', text: userText },
            ],
          },
        ],
        maxTokens,
        fallbackInputTokens: FALLBACK_IMAGE_INPUT_TOKENS,
        truncation: 'mark',
      },
      {
        transport: deps.transport,
        apiKey: deps.apiKey,
        costCap: deps.costCap,
        log,
        makeError: (code) => new VisionIntakeError(code),
      },
    )
    return text.trim()
  }
}
