/**
 * approval-llm-adapter.ts — 刀A 層2 的 Anthropic intent parser adapter
 * （design 2026-06-12 §1）。
 *
 * 整檔 mirror distill-llm-adapter.ts（同一條紀律鏈）：
 *   - 本模組只負責「context 三樣（原話＋候選清單＋引用內容）→ raw model text」；
 *     JSON 解析與所有 guards 都在 approval-intent.ts（純函式、零信任）。
 *   - transport 注入（fetch-shaped）— 不 import SDK，測試注入 fake、prod 注入真 fetch。
 *   - COST CAP（P0-A 刀 2 紀律）：每次呼叫前 checkBudget，非 `ok` 一律不打、
 *     throw fixed-code error；呼叫後 recordSpend，記帳失敗永不丟掉已付費的回覆。
 *   - 截斷偵測：stop_reason === 'max_tokens' 即截斷 — 截斷的 JSON 不可信，
 *     「先記帳再 throw」（已經打了就要記）。
 *
 * Prompt 安全邊界：進 prompt 的只有使用者在群裡說的一句話、剛貼群的候選清單、
 * 與被引用的 bot 訊息內容 — 不含真名、key、內部 operator notes。
 * 錯誤一律 fixed code，永不帶 key / prompt / 回應內文。
 */

import { type DailyCostCap } from '../observability/daily-cost-cap'
import { createAgentLogger, type AgentLogger } from '../observability/structured-log'
import { callAnthropicMessages } from '../observability/anthropic-call'

/** 單一 JSON 物件，256 綽綽有餘；再大就是模型失控，截斷偵測會擋。 */
export const APPROVAL_INTENT_MAX_TOKENS = 256

// ---------------------------------------------------------------------------
// Model resolution（mirror resolveDistillModel：explicit > env > default）
// ---------------------------------------------------------------------------

/** 批准語句是短句分類，Haiku 足夠（設計 §1 指定）。 */
export const APPROVAL_INTENT_MODEL_DEFAULT = 'claude-haiku-4-5'

export function resolveApprovalIntentModel(opts?: {
  model?: string
  env?: Record<string, string | undefined>
}): string {
  const explicit = opts?.model?.trim()
  if (explicit) return explicit
  const fromEnv = opts?.env?.AI_AGENT_APPROVE_LLM_MODEL?.trim()
  if (fromEnv) return fromEnv
  return APPROVAL_INTENT_MODEL_DEFAULT
}

// ---------------------------------------------------------------------------
// System prompt（exported for tests）
// ---------------------------------------------------------------------------

export const APPROVAL_INTENT_SYSTEM_INSTRUCTION = [
  '你是清邁包車旅行社內部 AI 的「批准語句解析器」。群組剛貼出一批知識庫候選（帶編號），',
  '使用者特意對 AI 說了一句話，你要判斷這句話是不是在批准收錄候選。',
  '你會看到：使用者原話、目前掛著的候選清單（編號＋問答）、使用者引用的 AI 訊息內容（如有）。',
  '判斷規則：',
  '- 明確指出要收哪幾條（含口語、錯字、簡寫）→ action=approve，編號放 indices',
  '- 表示全部都收 → action=approve_all',
  '- 要求修改某條答案再收 → action=modify，給 index 與 newAnswer；newAnswer 只能改寫使用者明說的內容，不得腦補',
  '- 在問問題、聊天、或與批准無關 → action=not_approval',
  '- 編號只能用候選清單裡存在的編號',
  '- 對使用者意圖有把握 → confidence=high；模稜兩可 → confidence=low',
  '- approve / approve_all / modify 一律必須帶 confidence',
  '只回一個 JSON 物件，不要任何前綴、後綴、說明或 code fence：',
  '{"action":"approve|approve_all|modify|not_approval","indices":[數字],"index":數字,"newAnswer":"…","confidence":"high|low"}',
  '用不到的欄位省略；not_approval 不需要 confidence。',
].join('\n')

// ---------------------------------------------------------------------------
// Request shape + prompt weaving（三樣 context 是行為的一部分）
// ---------------------------------------------------------------------------

export interface ApprovalIntentRequest {
  /** 使用者原話（未剝 mention — 模型看得懂 @bot）。 */
  text: string
  /** 掛著的候選清單全文（id 是貼群時的穩定編號）。 */
  candidates: Array<{ id: number; question: string; answer: string }>
  /** 使用者引用的 bot 訊息內容（如有）— 口語消歧的關鍵 context。 */
  quotedBotContent?: string
}

/** context 三樣 → raw model text（approval-intent.ts 零信任解析）。 */
export type ApprovalIntentSource = (req: ApprovalIntentRequest) => Promise<string>

/** Exported for tests — prompt 結構是行為的一部分。 */
export function buildApprovalIntentPrompt(req: ApprovalIntentRequest): string {
  const lines = ['【使用者原話】', req.text, '', '【掛著的候選清單】']
  for (const c of req.candidates) {
    lines.push(`${c.id}. Q：${c.question}`)
    lines.push(`   A：${c.answer}`)
  }
  const quoted = req.quotedBotContent?.trim()
  if (quoted) {
    lines.push('', '【使用者引用的 AI 訊息】', quoted)
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Source factory — transport + cost cap；錯誤一律 fixed code
// ---------------------------------------------------------------------------

/** Fixed-code、secret-free 的 adapter 錯誤（caller 收斂成降級/重試）。 */
export class ApprovalLlmError extends Error {
  constructor(code: string) {
    super(`approval intent llm call failed: ${code}`)
    this.name = 'ApprovalLlmError'
  }
}

export interface AnthropicApprovalIntentSourceDeps {
  /** fetch-shaped transport（tests 注入 fake；prod 注入 fetch）。 */
  transport: typeof fetch
  apiKey: string
  /** REQUIRED — 忘了接 cap 永遠不能等於無上限燒錢。 */
  costCap: DailyCostCap
  model?: string
  env?: Record<string, string | undefined>
  log?: AgentLogger
}

export function createAnthropicApprovalIntentSource(
  deps: AnthropicApprovalIntentSourceDeps
): ApprovalIntentSource {
  const model = resolveApprovalIntentModel({ model: deps.model, env: deps.env })
  const log = deps.log ?? createAgentLogger({ requestId: '-' })

  return async function approvalIntentSource(req: ApprovalIntentRequest): Promise<string> {
    // transport / cost cap / parse / record / 截斷='throw'（JSON 截斷不可信）
    // 全在共用 callAnthropicMessages；本層只織 prompt 並把 fixed code 映射成
    // ApprovalLlmError（保留既有錯誤型別）。
    const promptText = buildApprovalIntentPrompt(req)
    const { text } = await callAnthropicMessages(
      {
        model,
        system: APPROVAL_INTENT_SYSTEM_INSTRUCTION,
        messages: [{ role: 'user', content: promptText }],
        maxTokens: APPROVAL_INTENT_MAX_TOKENS,
        fallbackInputTokens: Math.ceil(
          (APPROVAL_INTENT_SYSTEM_INSTRUCTION.length + promptText.length) / 4,
        ),
        truncation: 'throw',
      },
      {
        transport: deps.transport,
        apiKey: deps.apiKey,
        costCap: deps.costCap,
        log,
        makeError: (code) => new ApprovalLlmError(code),
      },
    )
    return text
  }
}
