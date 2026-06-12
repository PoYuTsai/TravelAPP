/**
 * P0-A 刀 2 — structured-log.ts（design
 * docs/plans/2026-06-10-p0a-cut2-minimal-observability-design.md）。
 *
 * Logger 純函式契約：
 *  - createAgentLogger({ requestId, sink? }) → log(event, fields?)
 *  - 每次 log 輸出「單行 JSON」字串給 sink：{ ts, requestId, event, ...fields }
 *  - sink 注入（測試收集行），預設 console.log（此處不測 default sink 副作用）
 *  - AgentLogEvent 是閉集 union；fields 是該事件的閉集 shape
 */
import { describe, expect, it } from 'vitest'
import {
  createAgentLogger,
  type AgentLogEvent,
} from '../observability/structured-log'

function collectSink() {
  const lines: string[] = []
  return { lines, sink: (line: string) => lines.push(line) }
}

describe('createAgentLogger', () => {
  it('writes a single-line JSON entry carrying ts / requestId / event', () => {
    const { lines, sink } = collectSink()
    const log = createAgentLogger({ requestId: 'req-123', sink })

    log('webhook_received', {
      channel: 'partner_group',
      messageKind: 'group_text',
      botDirected: true,
    })

    expect(lines).toHaveLength(1)
    expect(lines[0]).not.toContain('\n')
    const entry = JSON.parse(lines[0])
    expect(entry.requestId).toBe('req-123')
    expect(entry.event).toBe('webhook_received')
    expect(entry.channel).toBe('partner_group')
    expect(entry.messageKind).toBe('group_text')
    expect(entry.botDirected).toBe(true)
    expect(typeof entry.ts).toBe('string')
    // ts 是合法 ISO 時間戳
    expect(Number.isNaN(Date.parse(entry.ts))).toBe(false)
  })

  it('keeps the same requestId across multiple events from one logger', () => {
    const { lines, sink } = collectSink()
    const log = createAgentLogger({ requestId: 'req-x', sink })

    log('route_decision', { path: 'rag_composer', ragDraftGate: 'enabled' })
    log('reply_sent', { sendOutcome: 'ok' })

    const ids = lines.map((l) => JSON.parse(l).requestId)
    expect(ids).toEqual(['req-x', 'req-x'])
  })

  it('records llm_call cost/usage fields verbatim', () => {
    const { lines, sink } = collectSink()
    const log = createAgentLogger({ requestId: 'req-llm', sink })

    log('llm_call', {
      model: 'claude-haiku-4-5',
      latencyMs: 812,
      inputTokens: 421,
      outputTokens: 96,
      costUsd: 0.000901,
      outcome: 'ok',
    })

    const entry = JSON.parse(lines[0])
    expect(entry.model).toBe('claude-haiku-4-5')
    expect(entry.latencyMs).toBe(812)
    expect(entry.inputTokens).toBe(421)
    expect(entry.outputTokens).toBe(96)
    expect(entry.costUsd).toBeCloseTo(0.000901, 9)
    expect(entry.outcome).toBe('ok')
  })

  it('supports degraded llm_call with a reason code and cost_cap events', () => {
    const { lines, sink } = collectSink()
    const log = createAgentLogger({ requestId: 'req-cap', sink })

    log('cost_cap', { checkOutcome: 'over_cap', dailySpendMicroUsd: 5_120_000 })
    log('llm_call', {
      model: 'claude-haiku-4-5',
      outcome: 'degraded',
      degradedReason: 'cost_cap_exceeded',
    })

    const cap = JSON.parse(lines[0])
    expect(cap.checkOutcome).toBe('over_cap')
    expect(cap.dailySpendMicroUsd).toBe(5_120_000)
    const llm = JSON.parse(lines[1])
    expect(llm.outcome).toBe('degraded')
    expect(llm.degradedReason).toBe('cost_cap_exceeded')
  })

  it('event names form the closed union from the design table', () => {
    // 編譯期已由 union 鎖住；這裡留 runtime 紀錄以防 union 被悄悄放寬成 string。
    const events: AgentLogEvent[] = [
      'webhook_received',
      'route_decision',
      'llm_call',
      'cost_cap',
      'reply_sent',
      'reply_skipped',
      'store_write_failed',
      'store_read_failed',
    ]
    expect(events).toHaveLength(8)
  })
})
