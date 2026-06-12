/**
 * agent-command-approve-parse.test.ts — `agent:approve-parse` 刀A CLI 黑箱內測
 * 入口（design 2026-06-12 §4）.
 *
 * 鐵律：不碰真 store（不讀不寫 pending/confirmation）、不貼群；候選清單來自
 * fixture。KV 只接 cost cap。測試走 kit-injection（同 agent-command-overdue
 * 模式）：層1/層2 解析用真函式，intent source 注入 fake — 零網路、零 KV。
 */

import { describe, expect, it } from 'vitest'
import {
  parseAgentCommandArgs,
  runApproveParseCommand,
} from '../../../../scripts/agent-command.mjs'
import { parseDistillApproval } from '../distill/approval'
import { parseApprovalIntentJson } from '../distill/approval-intent'
import { resolveApprovalIntentModel } from '../distill/approval-llm-adapter'
import { isDistillEnabled } from '../distill/run-distillation'

const FIXTURE = 'scripts/fixtures/distill-approve-candidates.json'

const ENV_OK = {
  AI_AGENT_DISTILL_ENABLED: 'true',
  ANTHROPIC_API_KEY: 'sk-test',
}

/** 真解析函式＋fake 周邊（KV / cost cap / source factory 不應被走到時就爆）。 */
function realKit(overrides: Record<string, unknown> = {}) {
  return {
    parseDistillApproval,
    parseApprovalIntentJson,
    resolveApprovalIntentModel,
    isDistillEnabled,
    createAnthropicApprovalIntentSource: () => {
      throw new Error('real source factory must not be called when intentSource is injected')
    },
    createDailyCostCap: () => {
      throw new Error('cost cap must not be built when intentSource is injected')
    },
    createKvClientFromEnv: () => null,
    ...overrides,
  }
}

describe('parseAgentCommandArgs approve-parse', () => {
  it('一句話＋--quoted＋--fixture 解析', () => {
    expect(
      parseAgentCommandArgs([
        'approve-parse',
        '大車',
        '保險一點',
        '--quoted',
        '球具建議大車',
        '--fixture',
        'x.json',
      ])
    ).toEqual({
      commandText: 'approve-parse',
      query: '大車 保險一點',
      quoted: '球具建議大車',
      fixture: 'x.json',
    })
  })

  it('缺一句話 → throw（不知道要解析什麼）', () => {
    expect(() => parseAgentCommandArgs(['approve-parse'])).toThrow('approve-parse')
  })

  it('slash 形式＋無 flag 也通', () => {
    expect(parseAgentCommandArgs(['/approve-parse', '1', '3', '要'])).toEqual({
      commandText: 'approve-parse',
      query: '1 3 要',
      quoted: undefined,
      fixture: undefined,
    })
  })
})

describe('runApproveParseCommand', () => {
  it('層1 regex 命中：零 LLM、印層級＋解析結果＋驗證通過', async () => {
    let llmCalls = 0
    const out = await runApproveParseCommand({
      env: ENV_OK,
      kit: realKit(),
      query: '1 3 要',
      fixture: FIXTURE,
      intentSource: async () => {
        llmCalls += 1
        return '{}'
      },
    })
    expect(out).toContain('層1 regex 命中')
    expect(out).toContain('"approve"')
    expect(out).toContain('[1,3]')
    expect(out).toContain('驗證通過：會收 1、3')
    expect(out).not.toContain('層2')
    expect(llmCalls).toBe(0)
  })

  it('層2：LLM 回 high approve → 印 intent＋deterministic 驗證（行號存在 fixture）', async () => {
    const seen: Array<{ text: string; quotedBotContent?: string; candidateIds: number[] }> = []
    const out = await runApproveParseCommand({
      env: ENV_OK,
      kit: realKit(),
      query: '大車那條收一下',
      quoted: '3. Q：高爾夫球具可以上車嗎？',
      fixture: FIXTURE,
      intentSource: async (req: {
        text: string
        candidates: Array<{ id: number }>
        quotedBotContent?: string
      }) => {
        seen.push({
          text: req.text,
          quotedBotContent: req.quotedBotContent,
          candidateIds: req.candidates.map((c) => c.id),
        })
        return '{"action":"approve","indices":[3],"confidence":"high"}'
      },
    })
    expect(out).toContain('層1 regex miss')
    expect(out).toContain('LLM intent')
    expect(out).toContain('"approve"')
    expect(out).toContain('驗證通過：會收 3')
    // 三樣 context 完整進 source：原話＋fixture 候選＋引用內容
    expect(seen).toEqual([
      {
        text: '大車那條收一下',
        quotedBotContent: '3. Q：高爾夫球具可以上車嗎？',
        candidateIds: [1, 2, 3],
      },
    ])
  })

  it('層2：行號超界 → 印「驗證失敗：沒有第 N 條」', async () => {
    const out = await runApproveParseCommand({
      env: ENV_OK,
      kit: realKit(),
      query: '第五條也收',
      fixture: FIXTURE,
      intentSource: async () => '{"action":"approve","indices":[5],"confidence":"high"}',
    })
    expect(out).toContain('驗證失敗：沒有第 5 條（整批拒絕）')
  })

  it('層2：not_approval → 印「會落回 responder」', async () => {
    const out = await runApproveParseCommand({
      env: ENV_OK,
      kit: realKit(),
      query: '清萊一日來回會不會太趕？',
      fixture: FIXTURE,
      intentSource: async () => '{"action":"not_approval"}',
    })
    expect(out).toContain('會落回 responder')
    expect(out).not.toContain('驗證通過')
  })

  it('層2：low confidence → 印複述確認提示', async () => {
    const out = await runApproveParseCommand({
      env: ENV_OK,
      kit: realKit(),
      query: '保險一點',
      fixture: FIXTURE,
      intentSource: async () => '{"action":"approve","indices":[1],"confidence":"low"}',
    })
    expect(out).toContain('驗證通過：會收 1')
    expect(out).toContain('複述確認')
  })

  it('層2：LLM 回傳不合法 JSON → 印防呆兜底', async () => {
    const out = await runApproveParseCommand({
      env: ENV_OK,
      kit: realKit(),
      query: '嗯嗯好喔',
      fixture: FIXTURE,
      intentSource: async () => '我覺得你是要收第一條',
    })
    expect(out).toContain('看不懂這句，要收哪幾條？例：1 3 要')
  })

  it('缺 AI_AGENT_DISTILL_ENABLED / ANTHROPIC_API_KEY → throw 明確訊息', async () => {
    await expect(
      runApproveParseCommand({
        env: { ANTHROPIC_API_KEY: 'sk-test' },
        kit: realKit(),
        query: '1 要',
        fixture: FIXTURE,
      })
    ).rejects.toThrow('AI_AGENT_DISTILL_ENABLED')

    await expect(
      runApproveParseCommand({
        env: { AI_AGENT_DISTILL_ENABLED: 'true' },
        kit: realKit(),
        query: '1 要',
        fixture: FIXTURE,
      })
    ).rejects.toThrow('ANTHROPIC_API_KEY')
  })

  it('未注入 intentSource 且缺 KV → throw（cost cap 紀律不豁免）', async () => {
    await expect(
      runApproveParseCommand({
        env: ENV_OK,
        kit: realKit(),
        query: '收一下那條', // regex miss → 需要真 source → 需要 KV cost cap
        fixture: FIXTURE,
      })
    ).rejects.toThrow('AGENT_KV_URL')
  })
})
