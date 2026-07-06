/**
 * agent-command-partner-image-respond.test.ts — `agent:partner-image-respond`
 * 截圖智慧回覆刀 CLI 黑箱驗收入口（截圖智慧回覆 design Task 6.1）.
 *
 * 用途：Eric 離線測截圖回覆品質（圖→need→agentic RAG/web→兩段）再開真群閘。
 * 鐵律：不貼群、不碰真 store；KV 只接 cost cap。測試走 kit-injection（同
 * agent-command-partner-respond 模式）：config selector / tool-gate 用真函式，
 * vision-need source / smart-reply agent / cost cap / KV 注入 fake — 零網路、
 * 零 KV、零 Notion、零模型。
 *
 * 反遺漏驗收（plan Important）：本刀必同時接 getRagIndex（AI_AGENT_NOTION_RAG_ENABLED
 * 閘）＋ webSearchEnabled（web_search 閘）— 舊 partner-respond 漏接 source 的
 * class of bug 不得重演。
 */

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  parseImageRespondArgs,
  runPartnerImageRespondCommand,
} from '../../../../scripts/agent-command.mjs'
import { getPartnerResponderConfig } from '../partner-group/responder-config'
import { canUseExternalTool } from '../tools/tool-gate'
import { loadToolConfig } from '../tools/tool-config'
import { isNotionRagEnabled } from '../line/itinerary-reference-wiring'
import { OUTBOUND_HEADER, INTERNAL_HEADER } from '../partner-group/smart-reply-agent'

const ENV_OK = {
  AI_AGENT_PARTNER_RESPONDER_MODE: 'anthropic',
  ANTHROPIC_API_KEY: 'sk-test',
  AI_AGENT_DEFAULT_MODEL: 'claude-test-default',
  AI_AGENT_RESEARCH_MODEL: 'claude-test-research',
  AI_AGENT_DAILY_COST_CAP_USD: '5',
}

/** 寫一張極小的假圖片檔，回傳路徑。 */
function writeFixtureImage(ext: string, bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0])): string {
  const dir = mkdtempSync(join(tmpdir(), 'img-respond-'))
  const path = join(dir, `shot.${ext}`)
  writeFileSync(path, bytes)
  return path
}

/** 真 config selector＋tool-gate＋fake 周邊（不應被走到時就爆）。 */
function realKit(overrides: Record<string, unknown> = {}) {
  return {
    getPartnerResponderConfig,
    canUseExternalTool,
    loadToolConfig,
    isNotionRagEnabled,
    buildItineraryIndexLoader: () => {
      throw new Error('itinerary index loader must not be built when RAG gate off')
    },
    createKvClientFromEnv: () => null,
    createDailyCostCap: () => {
      throw new Error('cost cap must not be built when a gate throws')
    },
    createAnthropicVisionNeedSource: () => {
      throw new Error('vision need source must not be built when a gate throws')
    },
    createSmartReplyAgent: () => {
      throw new Error('smart-reply agent must not be built when a gate throws')
    },
    ...overrides,
  }
}

/**
 * 紀錄 agent factory 收到的 deps（反遺漏接線驗）— 真 tool-gate / config，其餘
 * fake；need 回固定 brief，agent 回兩段文字。
 */
function makeRecordingKit(overrides: Record<string, unknown> = {}) {
  const agentDeps: Array<Record<string, unknown>> = []
  const needCalls: Array<unknown> = []
  const kit = realKit({
    createDailyCostCap: () => ({ checkBudget: async () => ({ outcome: 'ok' }) }),
    createAnthropicVisionNeedSource: () => async (image: unknown) => {
      needCalls.push(image)
      return { isConversation: true, summary: '客人問天燈節', knownFacts: [], gaps: [] }
    },
    createSmartReplyAgent: (deps: Record<string, unknown>) => {
      agentDeps.push(deps)
      return async () => ({
        text: `${OUTBOUND_HEADER}\n天燈節通常在 11 月\n${INTERNAL_HEADER}\n網路資料・待確認`,
        meta: { responder: 'llm', model: 'claude-test-default' },
      })
    },
    ...overrides,
  })
  return { kit, agentDeps, needCalls }
}

describe('parseImageRespondArgs', () => {
  it('解析圖片路徑（單一 positional）', () => {
    expect(parseImageRespondArgs(['partner-image-respond', './shot.jpg'])).toEqual({
      imagePath: './shot.jpg',
    })
    expect(parseImageRespondArgs(['/partner-image-respond', '/abs/shot.png'])).toEqual({
      imagePath: '/abs/shot.png',
    })
  })

  it('缺路徑 → throw（不知道要讀哪張圖）', () => {
    expect(() => parseImageRespondArgs(['partner-image-respond'])).toThrow('請帶圖片路徑')
  })

  it('帶 flag → throw 不支援 flag（不默默丟）', () => {
    expect(() => parseImageRespondArgs(['partner-image-respond', '--foo'])).toThrow(
      '不支援 flag'
    )
  })
})

describe('runPartnerImageRespondCommand', () => {
  it('mode 不是 anthropic → throw 明確訊息（黑箱要打真 API）', async () => {
    await expect(
      runPartnerImageRespondCommand({
        env: { ANTHROPIC_API_KEY: 'sk-test' },
        kit: realKit(),
        imagePath: writeFixtureImage('jpg'),
      })
    ).rejects.toThrow('AI_AGENT_PARTNER_RESPONDER_MODE')
  })

  it('缺 ANTHROPIC_API_KEY → throw 明確訊息', async () => {
    await expect(
      runPartnerImageRespondCommand({
        env: { AI_AGENT_PARTNER_RESPONDER_MODE: 'anthropic' },
        kit: realKit(),
        imagePath: writeFixtureImage('jpg'),
      })
    ).rejects.toThrow('ANTHROPIC_API_KEY')
  })

  it('缺 model env → throw 明確訊息（絕不 exit 0 印 stub）', async () => {
    const { AI_AGENT_DEFAULT_MODEL: _d, AI_AGENT_RESEARCH_MODEL: _r, ...env } = ENV_OK
    await expect(
      runPartnerImageRespondCommand({
        env,
        kit: realKit(),
        imagePath: writeFixtureImage('jpg'),
      })
    ).rejects.toThrow('AI_AGENT_DEFAULT_MODEL')
  })

  it('缺 cap env → throw 明確訊息（cap 未設靜默 disabled）', async () => {
    const { AI_AGENT_DAILY_COST_CAP_USD: _c, ...env } = ENV_OK
    await expect(
      runPartnerImageRespondCommand({
        env,
        kit: realKit(),
        imagePath: writeFixtureImage('jpg'),
      })
    ).rejects.toThrow('AI_AGENT_DAILY_COST_CAP_USD')
  })

  it('缺 KV → throw（cost cap 紀律不豁免）', async () => {
    await expect(
      runPartnerImageRespondCommand({
        env: ENV_OK,
        kit: realKit(),
        imagePath: writeFixtureImage('jpg'),
      })
    ).rejects.toThrow('AGENT_KV_URL')
  })

  it('圖檔不存在 → throw 明確訊息（讀檔失敗不丟 raw stack）', async () => {
    const { kit } = makeRecordingKit()
    await expect(
      runPartnerImageRespondCommand({
        env: ENV_OK,
        kit,
        kvClient: {},
        imagePath: '/nope/missing.jpg',
      })
    ).rejects.toThrow('讀不到圖片')
  })

  it('副檔名 .png → LineImageContent mediaType=image/png＋base64', async () => {
    const { kit, needCalls } = makeRecordingKit()
    await runPartnerImageRespondCommand({
      env: ENV_OK,
      kit,
      kvClient: {},
      imagePath: writeFixtureImage('png', Buffer.from([0x89, 0x50, 0x4e, 0x47])),
    })
    expect(needCalls).toHaveLength(1)
    const image = needCalls[0] as { base64: string; mediaType: string }
    expect(image.mediaType).toBe('image/png')
    expect(image.base64).toBe(Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64'))
  })

  it('副檔名 .jpeg → mediaType=image/jpeg', async () => {
    const { kit, needCalls } = makeRecordingKit()
    await runPartnerImageRespondCommand({
      env: ENV_OK,
      kit,
      kvClient: {},
      imagePath: writeFixtureImage('jpeg'),
    })
    expect((needCalls[0] as { mediaType: string }).mediaType).toBe('image/jpeg')
  })

  it('need→agent 鏈跑完＋輸出含兩段標頭', async () => {
    const { kit } = makeRecordingKit()
    const out = await runPartnerImageRespondCommand({
      env: ENV_OK,
      kit,
      kvClient: {},
      imagePath: writeFixtureImage('jpg'),
    })
    expect(out).toContain(OUTBOUND_HEADER)
    expect(out).toContain(INTERNAL_HEADER)
    expect(out).toContain('天燈節')
  })

  // ── 反遺漏接線：getRagIndex ＋ webSearchEnabled 同時接 ─────────────────────────

  it('RAG 閘開（AI_AGENT_NOTION_RAG_ENABLED=true）⇒ getRagIndex 注入 agent', async () => {
    const fakeLoader = async () => ({ entries: [] })
    const { kit, agentDeps } = makeRecordingKit({
      buildItineraryIndexLoader: () => fakeLoader,
    })
    await runPartnerImageRespondCommand({
      env: { ...ENV_OK, AI_AGENT_NOTION_RAG_ENABLED: 'true' },
      kit,
      kvClient: {},
      imagePath: writeFixtureImage('jpg'),
    })
    expect(typeof agentDeps[0].getRagIndex).toBe('function')
  })

  it('RAG 閘關 ⇒ getRagIndex===undefined（不接線、絕不建索引）', async () => {
    const { kit, agentDeps } = makeRecordingKit({
      buildItineraryIndexLoader: () => {
        throw new Error('loader must not be built when RAG gate off')
      },
    })
    await runPartnerImageRespondCommand({
      env: ENV_OK,
      kit,
      kvClient: {},
      imagePath: writeFixtureImage('jpg'),
    })
    expect(agentDeps[0].getRagIndex).toBeUndefined()
  })

  it('web_search 閘開（AI_AGENT_WEB_SEARCH_ENABLED=true＋cap）⇒ webSearchEnabled=true', async () => {
    const { kit, agentDeps } = makeRecordingKit()
    const out = await runPartnerImageRespondCommand({
      env: { ...ENV_OK, AI_AGENT_WEB_SEARCH_ENABLED: 'true', AI_AGENT_TOOL_COST_CAP_USD: '1.00' },
      kit,
      kvClient: {},
      imagePath: writeFixtureImage('jpg'),
    })
    expect(agentDeps[0].webSearchEnabled).toBe(true)
    expect(out).toContain('搜證：開')
  })

  it('web_search 閘關 ⇒ webSearchEnabled=false（照樣跑）', async () => {
    const { kit, agentDeps } = makeRecordingKit()
    const out = await runPartnerImageRespondCommand({
      env: ENV_OK,
      kit,
      kvClient: {},
      imagePath: writeFixtureImage('jpg'),
    })
    expect(agentDeps[0].webSearchEnabled).toBe(false)
    expect(out).toContain('搜證：關')
  })
})
