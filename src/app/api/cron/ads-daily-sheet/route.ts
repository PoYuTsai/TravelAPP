/**
 * GET /api/cron/ads-daily-sheet — 廣告刀8：每日轉換表 cron（薄殼 composition root）。
 *
 * Vercel cron（vercel.json，02:00 UTC = 09:00 Asia/Bangkok）帶
 * `Authorization: Bearer $CRON_SECRET` 觸發。驗 secret 後綁真 store / Sheets /
 * Haiku 摘要，交給可測 runner `runAdsDailySheet`（冪等）。route 本身無法純單元測，
 * 邏輯全在 runner（已綠）＋部署後 smoke。
 *
 * 紀律：
 *   - CRON_SECRET 空 或 header 不符 → 401（絕不在未驗證下觸網）。
 *   - 全程 try/catch；錯誤訊息回原文（不 minified），不外洩 stack。
 *   - costCap 型別轉接：summarizeOaInquiry 的 checkBudget 期望 'ok' | string，
 *     真 DailyCostCap 回 { outcome }，故包一層 adapter。callAnthropicMessages 內部
 *     另收原始 DailyCostCap 負責 recordSpend。
 */

import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/line-agent/line/webhook-runtime'
import { createKvClientFromEnv } from '@/lib/line-agent/storage/kv-store'
import { createDailyCostCap } from '@/lib/line-agent/observability/daily-cost-cap'
import { callAnthropicMessages } from '@/lib/line-agent/observability/anthropic-call'
import { createAgentLogger } from '@/lib/line-agent/observability/structured-log'
import { createSheetsClient } from '@/lib/line-agent/ads/sheets-client'
import {
  summarizeOaInquiry,
  type AdsCostCap,
  type OaSummary,
} from '@/lib/line-agent/ads/summary-adapter'
import type { OaContactMessage } from '@/lib/line-agent/ads/oa-contact-record'
import { runAdsDailySheet } from '@/lib/line-agent/ads/run-daily-sheet'

// cron route 絕不被靜態化 — 每次觸發都要跑真連線。
export const dynamic = 'force-dynamic'

const DEFAULT_SUMMARY_MODEL = 'claude-haiku-4-5-20251001'

class AdsSummaryLlmError extends Error {}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── 1. CRON_SECRET 驗證（空 secret 或不符一律 401）
  const secret = process.env.CRON_SECRET ?? ''
  if (secret === '' || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const env = process.env
    // AgentLogger（typed events）給 callAnthropicMessages 內部用。
    const agentLog = createAgentLogger({ requestId: 'ads-daily-sheet' })
    // 固定碼診斷 log（runner / summary 的窄 seam：(code, meta) => void）。
    const codeLog = (code: string, meta?: Record<string, unknown>): void => {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          requestId: 'ads-daily-sheet',
          event: code,
          ...meta,
        }),
      )
    }

    // ── 2. composition root：復用 webhook 既有 store 工廠 + KV + cost cap
    const store = getStore()
    const dailyCap = createDailyCostCap({ env, kv: createKvClientFromEnv() })

    // costCap 型別轉接：DailyCostCap.checkBudget() → { outcome } ；
    // summarizeOaInquiry 期望 'ok' | string。recordSpend 交由 callAnthropicMessages 內部處理。
    const summaryCostCap: AdsCostCap = {
      checkBudget: async () => {
        const check = await dailyCap.checkBudget()
        return check.outcome === 'ok' ? 'ok' : check.outcome
      },
      recordSpend: async (usd: number) => {
        await dailyCap.recordSpend(usd)
      },
    }

    // ── 3. Sheets client（service account JSON 由 env base64 帶入）
    const serviceAccountJson = Buffer.from(
      env.AI_AGENT_GOOGLE_SA_JSON ?? '',
      'base64',
    ).toString('utf-8')
    const sheets = createSheetsClient({ transport: fetch, serviceAccountJson })

    // ── 4. Haiku 摘要 adapter（閘＋cap 全在 summarizeOaInquiry；此處只綁 transport）
    const summaryModel = env.AI_AGENT_ADS_SUMMARY_MODEL ?? DEFAULT_SUMMARY_MODEL
    const summarize = (input: { messages: OaContactMessage[] | undefined }): Promise<OaSummary> =>
      summarizeOaInquiry(
        { messages: input.messages ?? [] },
        {
          env,
          llm: async (prompt: string) => {
            const { text } = await callAnthropicMessages(
              {
                model: summaryModel,
                system: '',
                messages: [{ role: 'user', content: prompt }],
                maxTokens: 300,
                fallbackInputTokens: Math.ceil(prompt.length / 4),
                truncation: 'ignore',
              },
              {
                transport: fetch,
                apiKey: env.ANTHROPIC_API_KEY ?? '',
                costCap: dailyCap,
                log: agentLog,
                makeError: (code) => new AdsSummaryLlmError(code),
              },
            )
            return text
          },
          costCap: summaryCostCap,
          log: codeLog,
        },
      )

    // ── 5. 交給冪等 runner
    const result = await runAdsDailySheet({
      store,
      sheets,
      summarize,
      spreadsheetId: env.AI_AGENT_ADS_SHEET_ID ?? '',
      range: env.AI_AGENT_ADS_SHEET_RANGE ?? 'A1',
      now: () => Date.now(),
      log: codeLog,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    // 外部呼叫全 try-catch；錯誤訊息保留原文，絕不 minified。
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
