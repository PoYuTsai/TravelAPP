/**
 * agent-command-case-intake-llm.test.ts — `agent:case-intake` CLI harness 的
 * LLM enrichment 模式（design 2026-06-10 §1 LLM 刀）.
 *
 * 鎖住三閘投影 + 真 enrichment 鏈（真 enrich + 真 adapter + fake transport，
 * 零實打）：
 *   - 任一閘關 ⇒ 輸出「LLM enrichment：未啟用（原因）」，transport 永不被呼叫
 *   - 三閘全開 + cost cap ok ⇒ 走完 enrichment 鏈，輸出 enriched 回覆
 *   - cost cap fail-closed（cap 未設 / KV 未接）⇒ degraded source_error，
 *     deterministic 回覆仍完整輸出
 */

import { describe, expect, test, vi } from 'vitest'
import {
  runCaseIntakeCommand,
  caseIntakeLlmGateStatus,
} from '../../../../scripts/agent-command.mjs'
import { triageCaseIntake } from '../partner-group/case-intake-triage'
import { enrichCaseIntakeReply } from '../partner-group/case-intake-enrichment'
import {
  createAnthropicCaseIntakeSources,
  resolveCaseIntakeLlmModel,
} from '../partner-group/case-intake-llm-adapter'
import { createDailyCostCap } from '../observability/daily-cost-cap'

const INSUFFICIENT_TEXT = '客人說 12 月想去清邁玩'

const WIRED_ENV = {
  AI_AGENT_CASE_INTAKE_LLM_ENABLED: 'true',
  AI_AGENT_CASE_INTAKE_LLM_RUNTIME: 'real',
  ANTHROPIC_API_KEY: 'k-test',
  AI_AGENT_DAILY_COST_CAP_USD: '1',
}

/** 真 kit（tsx 下 loader 會回的東西），kv 用記憶體 fake。 */
function realLlmKit(kvData = new Map<string, number>()) {
  return {
    enrich: enrichCaseIntakeReply,
    createSources: createAnthropicCaseIntakeSources,
    resolveModel: resolveCaseIntakeLlmModel,
    createDailyCostCap,
    createKvClientFromEnv: () => ({
      async get(key: string) {
        return kvData.get(key) ?? null
      },
      async incrByWithTtl(key: string, by: number) {
        const next = (Number(kvData.get(key)) || 0) + by
        kvData.set(key, next)
        return next
      },
    }),
  }
}

const TRIAGE_KIT = { triageCaseIntake }

function anthropicOk(text: string) {
  return new Response(
    JSON.stringify({ content: [{ text }], usage: { input_tokens: 80, output_tokens: 40 } }),
    { status: 200 }
  )
}

describe('caseIntakeLlmGateStatus — 三閘 fine-grained reasons', () => {
  test('default off → disabled；逐閘補齊 → wired', () => {
    expect(caseIntakeLlmGateStatus({})).toBe('disabled')
    expect(
      caseIntakeLlmGateStatus({ AI_AGENT_CASE_INTAKE_LLM_ENABLED: 'true' })
    ).toBe('runtime_not_real')
    expect(
      caseIntakeLlmGateStatus({
        AI_AGENT_CASE_INTAKE_LLM_ENABLED: 'true',
        AI_AGENT_CASE_INTAKE_LLM_RUNTIME: 'real',
      })
    ).toBe('missing_key')
    expect(caseIntakeLlmGateStatus(WIRED_ENV)).toBe('wired')
  })
})

describe('runCaseIntakeCommand — gate 投影', () => {
  test('gate 關（default）→ deterministic 結果 + 未啟用原因，transport 不可能被碰', async () => {
    const out = await runCaseIntakeCommand({
      query: INSUFFICIENT_TEXT,
      env: {},
      kit: TRIAGE_KIT,
    })
    expect(out).toContain('客需三分流')
    expect(out).toContain('回覆草稿')
    expect(out).toContain('LLM enrichment：未啟用')
    expect(out).toContain('AI_AGENT_CASE_INTAKE_LLM_ENABLED')
  })

  test('runtime 不是 real → 未啟用（runtime 原因）', async () => {
    const out = await runCaseIntakeCommand({
      query: INSUFFICIENT_TEXT,
      env: { AI_AGENT_CASE_INTAKE_LLM_ENABLED: 'true' },
      kit: TRIAGE_KIT,
    })
    expect(out).toContain('AI_AGENT_CASE_INTAKE_LLM_RUNTIME')
  })
})

describe('runCaseIntakeCommand — 三閘全開（fake transport，零實打）', () => {
  test('潤飾問句被採用 → 輸出 enriched 回覆', async () => {
    const triage = triageCaseIntake(INSUFFICIENT_TEXT)
    const askable = triage.missingFields
    const transport = vi.fn(async () =>
      anthropicOk(
        JSON.stringify(
          askable.map((field) => ({ field, question: '想跟您確認一下，方便提供嗎？' }))
        )
      )
    )
    const out = await runCaseIntakeCommand({
      query: INSUFFICIENT_TEXT,
      env: WIRED_ENV,
      kit: TRIAGE_KIT,
      llmKit: realLlmKit(),
      transport,
    })
    expect(transport).toHaveBeenCalledTimes(1)
    expect(out).toContain('LLM enrichment：llm_questions')
    expect(out).toContain('enriched 回覆')
    expect(out).toContain('想跟您確認一下')
  })

  test('cost cap 未設 → adapter fail-closed，degraded source_error，deterministic 結果仍在', async () => {
    const transport = vi.fn()
    const { AI_AGENT_DAILY_COST_CAP_USD: _cap, ...env } = WIRED_ENV
    const out = await runCaseIntakeCommand({
      query: INSUFFICIENT_TEXT,
      env,
      kit: TRIAGE_KIT,
      llmKit: realLlmKit(),
      transport,
    })
    expect(transport).not.toHaveBeenCalled()
    expect(out).toContain('LLM enrichment：none')
    expect(out).toContain('source_error')
    expect(out).toContain('回覆草稿')
  })

  test('LLM 回壞 JSON → guard 擋下，degraded invalid_json，不輸出 enriched 區塊', async () => {
    const transport = vi.fn(async () => anthropicOk('好的，我幫你問問'))
    const out = await runCaseIntakeCommand({
      query: INSUFFICIENT_TEXT,
      env: WIRED_ENV,
      kit: TRIAGE_KIT,
      llmKit: realLlmKit(),
      transport,
    })
    expect(out).toContain('LLM enrichment：none')
    expect(out).toContain('invalid_json')
    expect(out).not.toContain('enriched 回覆')
  })
})
