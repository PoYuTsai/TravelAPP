/**
 * agent-command-partner-respond.test.ts — `agent:partner-respond` 檢索閉環刀
 * CLI 黑箱驗收入口（design 2026-06-12 §2 驗收）.
 *
 * 鐵律：不碰真 store、不貼群；KV 只接 cost cap。測試走 kit-injection（同
 * agent-command-approve-parse 模式）：config selector 用真函式，responder
 * factory / installer / cost cap 注入 fake — 零網路、零 KV、零 Notion。
 */

import { describe, expect, it } from 'vitest'
import {
  parseAgentCommandArgs,
  runPartnerRespondCommand,
} from '../../../../scripts/agent-command.mjs'
import { getPartnerResponderConfig } from '../partner-group/responder-config'

const ENV_OK = {
  AI_AGENT_PARTNER_RESPONDER_MODE: 'anthropic',
  ANTHROPIC_API_KEY: 'sk-test',
  AI_AGENT_DEFAULT_MODEL: 'claude-test-default',
  AI_AGENT_RESEARCH_MODEL: 'claude-test-research',
  AI_AGENT_DAILY_COST_CAP_USD: '5',
}

/** 真 config selector＋fake 周邊（不應被走到時就爆）。 */
function realKit(overrides: Record<string, unknown> = {}) {
  return {
    getPartnerResponderConfig,
    createPartnerGroupResponder: () => {
      throw new Error('responder factory must not be called when a gate throws')
    },
    buildDefaultQaKnowledgeSource: () => {
      throw new Error('installer must not be called when a gate throws')
    },
    createDailyCostCap: () => {
      throw new Error('cost cap must not be built when a gate throws')
    },
    createKvClientFromEnv: () => null,
    ...overrides,
  }
}

describe('parseAgentCommandArgs partner-respond', () => {
  it('一句話（多 token）解析', () => {
    expect(
      parseAgentCommandArgs(['partner-respond', '兩大兩小', '小車會不會擠'])
    ).toEqual({ commandText: 'partner-respond', query: '兩大兩小 小車會不會擠' })
  })

  it('slash 形式也通', () => {
    expect(parseAgentCommandArgs(['/partner-respond', '兒童座椅'])).toEqual({
      commandText: 'partner-respond',
      query: '兒童座椅',
    })
  })

  it('缺一句話 → throw（不知道要問什麼）', () => {
    expect(() => parseAgentCommandArgs(['partner-respond'])).toThrow('請帶要問的話')
  })

  it('只有 flag 沒有話 → throw 不支援 flag（mirror approve-parse 的 flag 紀律）', () => {
    expect(() => parseAgentCommandArgs(['partner-respond', '--foo'])).toThrow(
      '不支援 flag'
    )
  })

  it('一句話＋flag → throw 不支援 flag（絕不默默丟 flag、把值併進 query 送 API）', () => {
    expect(() =>
      parseAgentCommandArgs(['partner-respond', '問題', '--quoted', '草稿'])
    ).toThrow('不支援 flag')
  })
})

describe('runPartnerRespondCommand', () => {
  it('mode 不是 anthropic → throw 明確訊息（絕不默默 degrade stub）', async () => {
    await expect(
      runPartnerRespondCommand({
        env: { ANTHROPIC_API_KEY: 'sk-test' },
        kit: realKit(),
        query: '兩大兩小小車會不會擠',
      })
    ).rejects.toThrow('AI_AGENT_PARTNER_RESPONDER_MODE')
  })

  it('缺 ANTHROPIC_API_KEY → throw 明確訊息', async () => {
    await expect(
      runPartnerRespondCommand({
        env: { AI_AGENT_PARTNER_RESPONDER_MODE: 'anthropic' },
        kit: realKit(),
        query: '兩大兩小小車會不會擠',
      })
    ).rejects.toThrow('ANTHROPIC_API_KEY')
  })

  it('缺 model env → throw 明確訊息（驗收 CLI 絕不 exit 0 印 stub）', async () => {
    const { AI_AGENT_DEFAULT_MODEL: _d, AI_AGENT_RESEARCH_MODEL: _r, ...env } = ENV_OK
    await expect(
      runPartnerRespondCommand({
        env,
        kit: realKit(),
        query: '兩大兩小小車會不會擠',
      })
    ).rejects.toThrow('缺 AI_AGENT_DEFAULT_MODEL / AI_AGENT_RESEARCH_MODEL')
  })

  it('缺 cap env → throw 明確訊息（cap 未設會靜默 disabled，不得當過關）', async () => {
    const { AI_AGENT_DAILY_COST_CAP_USD: _c, ...env } = ENV_OK
    await expect(
      runPartnerRespondCommand({
        env,
        kit: realKit(),
        query: '兩大兩小小車會不會擠',
      })
    ).rejects.toThrow('缺 AI_AGENT_DAILY_COST_CAP_USD')
  })

  it('缺 KV → throw（cost cap 紀律不豁免）', async () => {
    await expect(
      runPartnerRespondCommand({
        env: ENV_OK,
        kit: realKit(),
        query: '兩大兩小小車會不會擠',
      })
    ).rejects.toThrow('AGENT_KV_URL')
  })

  it('閘齊：costCap 進 factory、知識閘關照樣問、印 reason＋meta＋回覆', async () => {
    const seen: Array<Record<string, unknown>> = []
    const fakeCostCap = { checkBudget: async () => ({ outcome: 'ok' }) }
    const out = await runPartnerRespondCommand({
      env: ENV_OK,
      kit: realKit({
        buildDefaultQaKnowledgeSource: () => ({ reason: 'disabled' }),
        createDailyCostCap: () => fakeCostCap,
        createPartnerGroupResponder: (input: Record<string, unknown>) => {
          expect(input.costCap).toBe(fakeCostCap)
          expect(input.knowledgeSource).toBeUndefined()
          return {
            respond: async (respondInput: Record<string, unknown>) => {
              seen.push(respondInput)
              return { text: '小車四人加行李會偏擠', meta: { responder: 'llm' } }
            },
          }
        },
      }),
      kvClient: {},
      query: '兩大兩小小車會不會擠',
    })
    expect(out).toContain('partner-respond（黑箱驗收 — 不碰真 store、不貼群）')
    expect(out).toContain('知識源：未接（disabled）')
    expect(out).toContain('"responder":"llm"')
    expect(out).toContain('小車四人加行李會偏擠')
    // 最小 event＋正確 CommandIntent 物件（routePartnerModel 讀 .action）
    expect(seen).toEqual([
      {
        event: { kind: 'group_text', sourceChannel: 'partner_group', mentionsBot: true },
        intent: { action: 'respond', confidence: 'high', source: 'deterministic' },
        text: '兩大兩小小車會不會擠',
        botDirected: true,
      },
    ])
  })

  it('知識閘開：source 接進 factory、印「已接」', async () => {
    const fakeSource = async () => '【沉澱知識】'
    const out = await runPartnerRespondCommand({
      env: ENV_OK,
      kit: realKit({
        buildDefaultQaKnowledgeSource: () => ({ source: fakeSource }),
        createDailyCostCap: () => ({}),
        createPartnerGroupResponder: (input: Record<string, unknown>) => {
          expect(input.knowledgeSource).toBe(fakeSource)
          return {
            respond: async () => ({ text: 'ok', meta: { responder: 'llm' } }),
          }
        },
      }),
      kvClient: {},
      query: '兒童座椅怎麼算',
    })
    expect(out).toContain('知識源：已接（QA_KNOWLEDGE_READ_ENABLED 閘開）')
  })
})
