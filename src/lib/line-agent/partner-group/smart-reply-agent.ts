/**
 * 夥伴群「截圖智慧回覆」agent —— 兩段輸出。
 *
 * 用途：夥伴在 LINE 夥伴群貼一張客人截圖並 tag bot，bot 幫夥伴準備好可回客人的內容。
 * 產出固定兩段：
 *   1.【可直接複製給客人】乾淨、可整段複製貼給客人的對外內容（零贅述）。
 *   2.【內部備註・待確認】給夥伴看的佐證/補充，以及只列「真缺」的待確認項。
 *
 * 查資料原則：清邁相關優先呼叫 search_chiangmai_cases（自家案例最可信），
 * 查不到或屬一般開放問題再用 web_search（措辭保守、標「待確認」）。
 *
 * bot 只回夥伴群，絕不代發、不直接稱呼客人。
 *
 * 本檔放 system prompt + 純函式 helper + agentic tool_use 迴圈（Task 3.2）。
 */

import {
  STUB_PARTNER_GROUP_REPLY,
  type PartnerGroupRespondInput,
  type PartnerGroupRespondResult,
} from './responder'
import { RAG_CASE_TOOL_DEF, runRagCaseTool } from './rag-case-tool'
import type { VisionNeedBrief } from './vision-need-extraction'
import type { RagIndex } from '../notion/rag-index'
import { createAgentLogger, type AgentLogger } from '../observability/structured-log'
import { estimateCostUsd, type DailyCostCap } from '../observability/daily-cost-cap'

export const OUTBOUND_HEADER = '【可直接複製給客人】'
export const INTERNAL_HEADER = '【內部備註・待確認】'

export const SMART_REPLY_SYSTEM_PROMPT = [
  '你是清邁包車旅行社「清微旅行」的內部 AI 助手。夥伴會貼一張客人截圖並 tag 你，你要幫夥伴',
  '準備好可以回客人的內容。你**只**回給夥伴群，夥伴會自己決定怎麼轉給客人——你絕不代發、不直接稱呼客人。',
  '',
  '查資料原則：',
  '- 只要問題跟清邁有關（餐廳、景點、行程、親子安排），**先呼叫 search_chiangmai_cases** 查自家真實案例；',
  '  查到就以自家案例為主幹（最可信）。',
  '- 自家案例查不到、不相關，或是一般開放問題（天氣、簽證、匯率、最新資訊等），用 web_search 上網查。',
  '- 兩個都查得到就整合；都不需要就用你已知的，但不確定的事絕不腦補。',
  '',
  '輸出**固定兩段**，照這個格式（兩個標頭都必須出現）：',
  `${OUTBOUND_HEADER}`,
  '（乾淨、可直接整段複製貼給客人的內容。不要寫「我幫你整理」「以上若需修正」這類贅述，不要稱呼夥伴，',
  ' 直接就是給客人看的話。用自家案例的內容可以直接寫；上網查到、還沒跟客人確認的，措辭保守。）',
  '',
  `${INTERNAL_HEADER}`,
  '（給夥伴看的備註：哪些是自家案例佐證、哪些是網路查的（標「網路資料・待確認」）、哪些是你的補充；',
  ' 以及「待確認項」——**只列**客人截圖裡真的沒提到、但報價/排行程需要的（如航班、住宿、上車點）。',
  ' 圖裡已寫的不要再問。沒有待確認就寫「無」。這段可精簡。）',
].join('\n')

/** Fail-safe：LLM 萬一沒照兩段格式，至少包成對外段 —— 夥伴永遠有可複製內容。 */
export function ensureTwoSegments(text: string): string {
  const t = text.trim()
  if (t.includes(OUTBOUND_HEADER)) return text
  return `${OUTBOUND_HEADER}\n${t}`
}

// ── agentic tool_use 迴圈（Task 3.2）─────────────────────────────────────────

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MAX_TOKENS = 1024

/**
 * 迴圈 ceiling（不是期望值）：正常 0–2 輪就收斂；4 是防呆上限，到頂仍 tool_use
 * 就強制用最後一輪的文字收斂、log max_rounds，絕不無限迴圈。
 */
const MAX_ROUNDS = 4

/** 外部佐證刀 — web_search server tool 每題搜尋次數上限（鏡像 anthropic-responder）。 */
const WEB_SEARCH_MAX_USES = 3
/** Anthropic web_search 計費：$10 / 1000 次。 */
const WEB_SEARCH_COST_PER_REQUEST_USD = 0.01
/** 文末來源連結上限。 */
const MAX_SOURCE_URLS = 3
/** RAG client tool 每次檢索回傳上限（未注入 maxResults 時的預設）。 */
const DEFAULT_RAG_MAX_RESULTS = 3

/** 到頂仍 tool_use 又無任何文字可用時的收斂保底句（夥伴永遠有回覆）。 */
const MAX_ROUNDS_FALLBACK_TEXT =
  '這題我查了幾輪還沒收斂，先把目前掌握的整理給夥伴，細節請夥伴再確認或 tag Eric。'

/** Map a non-ok budget outcome to its fixed degraded error code（鏡像 anthropic-responder）。 */
const COST_CAP_ERROR_CODE = {
  over_cap: 'cost_cap_exceeded',
  disabled: 'cost_cap_disabled',
  kv_unavailable: 'cost_cap_kv_unavailable',
} as const

/** Safe-default fallback：stub 文字 + 可觀測的 error code（鏡像 anthropic-responder degraded()）。 */
function degraded(model: string, error: string): PartnerGroupRespondResult {
  return {
    text: STUB_PARTNER_GROUP_REPLY,
    meta: { responder: 'stub', model, degraded: true, error },
  }
}

export interface SmartReplyAgentDeps {
  /** Injected fetch-shaped transport — 測試注入 fake；prod 注入 fetch。 */
  transport: typeof fetch
  /** Anthropic API key（非空 — factory 在空時降級到 stub）。 */
  apiKey: string
  /** 模型 id。 */
  defaultModel: string
  /** Daily cost cap（REQUIRED）— 每次 POST 前 checkBudget，fail-closed。 */
  costCap: DailyCostCap
  /**
   * RAG index 取得器（OPTIONAL）— 注入 ⇒ 掛 search_chiangmai_cases client tool；
   * undefined ⇒ 不掛 RAG。responder 不讀 env、不 import Notion client。
   */
  getRagIndex?: () => Promise<RagIndex>
  /**
   * 外部佐證刀 — web_search server tool 開關。composition root 判定後注入；
   * per-request 仍會再收窄（OA 永不、非 botDirected 不掛）。
   */
  webSearchEnabled?: boolean
  /** RAG 每次檢索回傳上限（省略 ⇒ 預設 3）。 */
  maxResults?: number
  /** 注入式 env（保留 — 本實作不讀，forwarding 友善）。 */
  env?: Record<string, string | undefined>
  /** 注入式 logger fallback（input.log 缺時用）。 */
  log?: AgentLogger
}

type AnthropicContentBlock = {
  type?: string
  text?: string
  citations?: unknown
  id?: string
  name?: string
  input?: unknown
}

type AnthropicResponseJson = {
  stop_reason?: string
  content?: AnthropicContentBlock[]
  usage?: {
    input_tokens?: unknown
    output_tokens?: unknown
    server_tool_use?: { web_search_requests?: unknown }
  }
}

type ChatMessage = { role: 'user' | 'assistant'; content: unknown }

/**
 * 截圖智慧回覆 agentic 迴圈工廠。
 *
 * 回傳 `(brief, input) => Promise<PartnerGroupRespondResult>`：把 VisionNeedBrief
 * 序列化成第一則 user message，掛 RAG client tool（注入時）＋ web_search server
 * tool（開閘＋per-request 收窄），跑多輪 tool_use 迴圈。
 *
 * 硬規則：
 *  - 每次 POST 前 checkBudget；非 ok ⇒ 不 POST、回 degrade stub（fail-closed）。
 *  - 任何 transport throw / 非 200 / parse 失敗 ⇒ degrade（固定碼）、**絕不 throw**。
 *  - tool_use ⇒ 跑 client RAG tool，回填 assistant + tool_result（id 配對），續迴圈。
 *    web_search 是 server tool — Anthropic 同回應內跑完，只收 citations、不開 client 輪。
 *  - 到 MAX_ROUNDS 仍 tool_use ⇒ 用最後文字收斂、log max_rounds，不無限迴圈。
 *  - 每次成功 POST 後 recordSpend（token 估 + 搜尋費）；記帳失敗不掉回覆。
 */
export function createSmartReplyAgent(
  deps: SmartReplyAgentDeps,
): (brief: VisionNeedBrief, input: PartnerGroupRespondInput) => Promise<PartnerGroupRespondResult> {
  const transport = deps.transport
  const apiKey = deps.apiKey
  const model = deps.defaultModel
  const costCap = deps.costCap
  const getRagIndex = deps.getRagIndex
  const webSearchEnabled = deps.webSearchEnabled === true
  const maxResults = deps.maxResults ?? DEFAULT_RAG_MAX_RESULTS

  return async (brief, input) => {
    const log: AgentLogger = input.log ?? deps.log ?? createAgentLogger({ requestId: '-' })

    // per-request 防衛性收窄（鏡像 anthropic-responder allowWebSearch）：deps 開閘
    // 之外，本則訊息還要確實 bot-directed 且不在 OA 客人面。只收窄、永不放寬。
    const allowWebSearch =
      webSearchEnabled &&
      input.event.sourceChannel !== 'line_oa' &&
      (input.botDirected ?? input.event.mentionsBot) === true

    const tools: unknown[] = []
    if (getRagIndex) tools.push(RAG_CASE_TOOL_DEF)
    if (allowWebSearch) {
      tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES })
    }

    const firstUserText =
      `客人需求：${brief.summary}\n` +
      `已知：${brief.knownFacts.join('、') || '（無）'}\n` +
      `圖中未提供：${brief.gaps.join('、') || '（無）'}`

    const messages: ChatMessage[] = [{ role: 'user', content: firstUserText }]

    // 跨輪累積的來源（去重）— web_search server tool 的 citations 可能散在各輪。
    const sourceUrls: string[] = []
    // 最後一輪取得的文字（給 MAX_ROUNDS 收斂用）。
    let lastText = ''

    /** 收尾：text → ensureTwoSegments → 附「資料來源」→ success result。 */
    const finalize = (text: string): PartnerGroupRespondResult => {
      const twoSeg = ensureTwoSegments(text)
      const finalText =
        sourceUrls.length > 0
          ? `${twoSeg}\n\n資料來源：\n${sourceUrls
              .slice(0, MAX_SOURCE_URLS)
              .map((u) => `- ${u}`)
              .join('\n')}`
          : twoSeg
      return { text: finalText, meta: { responder: 'llm', model } }
    }

    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      // BUDGET GATE — 每次 POST 前都查。非 ok ⇒ 不 POST、fail-closed 回 stub。
      const budget = await costCap.checkBudget()
      log('cost_cap', {
        checkOutcome: budget.outcome,
        dailySpendMicroUsd: budget.dailySpendMicroUsd,
      })
      if (budget.outcome !== 'ok') {
        const error = COST_CAP_ERROR_CODE[budget.outcome]
        log('llm_call', { model, outcome: 'degraded', degradedReason: error })
        return degraded(model, error)
      }

      const startedAt = Date.now()
      let response: Response
      try {
        response = await transport(ANTHROPIC_MESSAGES_URL, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: MAX_TOKENS,
            system: SMART_REPLY_SYSTEM_PROMPT,
            messages,
            ...(tools.length > 0 ? { tools } : {}),
          }),
        })
      } catch {
        // Transport threw（network/DNS/abort）— 絕不 500 webhook。code-only log。
        log('llm_call', {
          model,
          latencyMs: Date.now() - startedAt,
          outcome: 'degraded',
          degradedReason: 'anthropic_api_error',
        })
        return degraded(model, 'anthropic_api_error')
      }

      if (!response.ok) {
        log('llm_call', {
          model,
          latencyMs: Date.now() - startedAt,
          outcome: 'degraded',
          degradedReason: 'anthropic_non_200',
          httpStatus: response.status,
        })
        return degraded(model, 'anthropic_non_200')
      }

      let data: AnthropicResponseJson
      try {
        data = (await response.json()) as AnthropicResponseJson
      } catch {
        log('llm_call', {
          model,
          latencyMs: Date.now() - startedAt,
          outcome: 'degraded',
          degradedReason: 'anthropic_parse_error',
        })
        return degraded(model, 'anthropic_parse_error')
      }

      const blocks = Array.isArray(data.content) ? data.content : []
      const textBlocks = blocks.filter(
        (b): b is AnthropicContentBlock & { text: string } => typeof b?.text === 'string',
      )
      const roundText = textBlocks.map((b) => b.text).join('')
      if (roundText.trim() !== '') lastText = roundText

      // citations 跨輪去重收集（web_search server tool 的來源）。
      for (const block of textBlocks) {
        const citations = Array.isArray(block.citations) ? block.citations : []
        for (const c of citations as Array<{ url?: unknown }>) {
          if (typeof c?.url === 'string' && c.url !== '' && !sourceUrls.includes(c.url)) {
            sourceUrls.push(c.url)
          }
        }
      }

      // SPEND RECORDING — 呼叫已發生。usage 缺 ⇒ 保守估（絕不記 0）。
      const usage = data.usage
      const inputTokensRaw = usage?.input_tokens
      const outputTokensRaw = usage?.output_tokens
      const usageMissing =
        typeof inputTokensRaw !== 'number' || typeof outputTokensRaw !== 'number'
      const inputTokens = usageMissing
        ? Math.ceil(JSON.stringify(messages).length / 4)
        : (inputTokensRaw as number)
      const outputTokens = usageMissing ? MAX_TOKENS : (outputTokensRaw as number)
      const searchRequestsRaw = usage?.server_tool_use?.web_search_requests
      const searchRequests =
        typeof searchRequestsRaw === 'number' && searchRequestsRaw > 0 ? searchRequestsRaw : 0
      const billedSearches =
        usageMissing && allowWebSearch ? WEB_SEARCH_MAX_USES : searchRequests
      const costUsd =
        estimateCostUsd(model, inputTokens, outputTokens) +
        billedSearches * WEB_SEARCH_COST_PER_REQUEST_USD

      const { recorded } = await costCap.recordSpend(costUsd)
      if (!recorded) log('cost_cap', { reason: 'record_failed' })

      // tool_use：跑 client RAG tool（web_search 是 server tool，同回應跑完，不開 client 輪）。
      const ragToolUses = blocks.filter(
        (b): b is AnthropicContentBlock & { id: string; name: string } =>
          b?.type === 'tool_use' &&
          b?.name === RAG_CASE_TOOL_DEF.name &&
          typeof b?.id === 'string',
      )

      if (data.stop_reason === 'tool_use' && getRagIndex && ragToolUses.length > 0) {
        log('llm_call', {
          model,
          latencyMs: Date.now() - startedAt,
          inputTokens,
          outputTokens,
          costUsd,
          outcome: 'ok',
          ...(usageMissing ? { usageMissing: true } : {}),
          ...(billedSearches > 0 ? { webSearchRequests: billedSearches } : {}),
        })

        // 回填 assistant turn（整包 content，含 tool_use blocks）。
        messages.push({ role: 'assistant', content: blocks })

        // 每個 RAG tool_use → 跑工具 → 一個 tool_result（id 配對）。
        const toolResults: unknown[] = []
        for (const block of ragToolUses) {
          const queryInput =
            block.input && typeof (block.input as { query?: unknown }).query === 'string'
              ? { query: (block.input as { query: string }).query }
              : { query: '' }
          const result = await runRagCaseTool(queryInput, { getIndex: getRagIndex, maxResults })
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        }
        messages.push({ role: 'user', content: toolResults })
        continue
      }

      // 非 tool_use（或無可跑的 client tool）⇒ 收斂回覆。
      log('llm_call', {
        model,
        latencyMs: Date.now() - startedAt,
        inputTokens,
        outputTokens,
        costUsd,
        outcome: 'ok',
        ...(usageMissing ? { usageMissing: true } : {}),
        ...(billedSearches > 0 ? { webSearchRequests: billedSearches } : {}),
      })
      return finalize(roundText.trim() !== '' ? roundText : lastText || MAX_ROUNDS_FALLBACK_TEXT)
    }

    // 到 MAX_ROUNDS 仍 tool_use ⇒ 強制收斂（用最後文字或保底句），絕不無限迴圈。
    log('llm_call', { model, outcome: 'degraded', degradedReason: 'max_rounds' })
    return finalize(lastText || MAX_ROUNDS_FALLBACK_TEXT)
  }
}
