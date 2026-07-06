/**
 * structured-log.ts — P0-A 刀 2 minimal observability（design
 * docs/plans/2026-06-10-p0a-cut2-minimal-observability-design.md）。
 *
 * Single-line JSON logger for the LINE agent webhook chain. One logger instance
 * per inbound webhook event carries ONE requestId, so every entry a message
 * produces（收件 → 路由決策 → LLM 結果 → 送出）can be joined on that id.
 *
 * MASKED BY CONSTRUCTION：`AgentLogFields` is a closed union of per-event field
 * shapes — enum-ish codes, counts, and numbers only. There is no free-text
 * field, so a token / db id / message body / PII has no slot to leak through.
 * Never widen a field to `string` carrying user content; add a new code value
 * instead.
 *
 * The sink is injected (tests collect lines); default is `console.log`, which
 * Vercel captures as one structured log line per call.
 */

/** Closed set of log events（design 表格 + store_write_failed bookkeeping）。 */
export type AgentLogEvent =
  | 'webhook_received'
  | 'route_decision'
  | 'llm_call'
  | 'cost_cap'
  | 'reply_sent'
  | 'reply_skipped'
  | 'store_write_failed'
  | 'store_read_failed'
  | 'qa_knowledge_truncated'
  | 'qa_knowledge_unavailable'
  | 'itinerary_reference_unavailable'
  | 'itinerary_reference'

/** Per-event closed field shapes. All values are codes / numbers / booleans. */
export interface AgentLogFieldsByEvent {
  webhook_received: {
    channel?: 'oa' | 'partner_group'
    messageKind?: string
    botDirected?: boolean
  }
  route_decision: {
    path?: 'rag_composer' | 'quoted_draft' | 'base' | 'no_reply' | 'case_intake' | 'vision_intake'
    /** Gate STATE words only（enabled/disabled）— never an env var value. */
    ragDraftGate?: 'enabled' | 'disabled'
    /** case_intake 三分流結果（fixed vocabulary, never content）。 */
    flow?: 'insufficient' | 'sufficient' | 'tricky'
    /** case_intake LLM enrichment 採用狀態（fixed vocabulary）。 */
    enrichment?: 'llm_questions' | 'llm_draft' | 'none'
    /** Fixed degraded code（e.g. roundtrip_failed）— never content. */
    degradedReason?: string
    reason?: string
    /**
     * vision_intake 真客人對話分叉（design 決策 #2，固定碼 draft|respond，
     * never content）：draft ＝ 行程類截圖走 golden 範本草稿路；respond ＝
     * 開放題走 agentic 路。
     */
    visionIntent?: 'draft' | 'respond'
  }
  llm_call: {
    model?: string
    latencyMs?: number
    inputTokens?: number
    outputTokens?: number
    costUsd?: number
    outcome?: 'ok' | 'degraded'
    /** Fixed sanitized code（e.g. cost_cap_exceeded / anthropic_api_error）。 */
    degradedReason?: string
    /** HTTP status of a non-200 Anthropic response（a number, never a body）。 */
    httpStatus?: number
    /** True when the response carried no usage and tokens were estimated. */
    usageMissing?: boolean
    /** 外部佐證刀 — 本次回應實際（或保守估）的 web_search 次數。 */
    webSearchRequests?: number
  }
  cost_cap: {
    checkOutcome?: 'ok' | 'over_cap' | 'kv_unavailable' | 'disabled'
    /** 當日累計（micro-USD 整數）— a count, never a secret. */
    dailySpendMicroUsd?: number
    reason?: string
  }
  reply_sent: {
    sendOutcome?: 'ok' | 'error'
    reason?: string
  }
  reply_skipped: {
    sendOutcome?: 'skipped'
    reason?: string
  }
  store_write_failed: {
    /** Fixed code（e.g. bot_msg_record_failed）— never the raw store error. */
    reason?: string
  }
  store_read_failed: {
    /** Fixed code（e.g. distill_pending_read_failed）— never the raw store error. */
    reason?: string
  }
  qa_knowledge_truncated: {
    /** 已批准條目總數（a count, never content）。 */
    total?: number
    /** 注入條目數（<= cap）。 */
    kept?: number
  }
  qa_knowledge_unavailable: {
    /** Fixed code only — never the raw Notion error（token / db id / url）。 */
    reason?: string
  }
  itinerary_reference_unavailable: {
    /** Fixed code only — never the raw Notion error（token / db id / url）。 */
    reason?: string
  }
  itinerary_reference: {
    /**
     * M-1 來源訊號（固定碼 golden|case|template，never content）：某筆 draft 命中
     * golden 四案、用真案例、或退手工範本 — 調語料涵蓋率的關鍵。第4刀新增 golden。
     */
    referenceSource?: 'golden' | 'case' | 'template'
  }
}

export type AgentLogger = <E extends AgentLogEvent>(
  event: E,
  fields?: AgentLogFieldsByEvent[E],
) => void

export interface CreateAgentLoggerDeps {
  /** Correlation id：webhook 收件時生成，貫穿該則訊息所有 log 行。 */
  requestId: string
  /** Line sink。預設 console.log；測試注入收集器。 */
  sink?: (line: string) => void
}

/**
 * Module-level default-sink override. Lets a test capture the lines a
 * deep-in-the-chain logger (built without an explicit sink) would print to
 * console.log. Production never calls this; pass null to restore the default.
 */
let _defaultSink: ((line: string) => void) | null = null

/** Override the default sink (tests only — restore with null in afterEach). */
export function setDefaultAgentLogSink(sink: ((line: string) => void) | null): void {
  _defaultSink = sink
}

/** Build a logger bound to one requestId. Each call emits ONE JSON line. */
export function createAgentLogger(deps: CreateAgentLoggerDeps): AgentLogger {
  const sink = deps.sink ?? _defaultSink ?? ((line: string) => console.log(line))
  const requestId = deps.requestId

  return (event, fields) => {
    sink(
      JSON.stringify({
        ts: new Date().toISOString(),
        requestId,
        event,
        ...(fields ?? {}),
      }),
    )
  }
}
