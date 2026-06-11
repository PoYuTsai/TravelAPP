/**
 * distilled-qa-writer.ts — 沉澱刀3：批准候選 → Notion 沉澱問答 DB 寫入 adapter.
 *
 * Mirror notion-rag-client.ts 的紀律，方向相反（寫不是讀）：
 *   - SDK 注入式（databases.retrieve ＋ pages.create 的最小面），單元測試用 fake，
 *     真 Client 只在 composition root（install-default-distilled-qa-writer.ts）構建。
 *   - v5 data-source 模型：先 retrieve 解析 data_sources[0]，pages.create 用
 *     data_source_id parent；id 在 writer 實例內 lazy cache（單 source DB）。
 *   - Leak guard：SDK error 一律收斂成 DistilledQaWriteError（fixed message），
 *     token / db id / notion.so url 永不外洩。
 *   - 只寫這一個 DB — caller 給什麼 databaseId 寫什麼，但本 writer 永遠由
 *     NOTION_DISTILLED_QA_DB 構建（絕不碰案件 DB — 設計 §3 ⑤ 鐵律）。
 *
 * 欄位型別已對真 DB schema 驗證（2026-06-12，Task 3 Step 0 唯讀 GET）：
 *   問題=title、答案=rich_text、出處=rich_text、出現次數=number、狀態=select、
 *   收錄日期=date、地區/主題=multi_select（留空）— 與 plan 預期完全一致。
 */

import type { DistillCandidate } from './pending'

/** 注入 SDK 的最小結構面（真 @notionhq/client v5 Client 結構相容）。 */
export interface DistilledQaSdkClient {
  databases: {
    retrieve(args: { database_id: string }): Promise<{
      data_sources?: Array<{ id: string }>
    }>
  }
  pages: {
    create(args: {
      parent: { type: 'data_source_id'; data_source_id: string }
      properties: Record<string, unknown>
    }): Promise<{ id: string }>
  }
}

/** Sanitized 寫入錯誤 — fixed message，絕不帶 token / db id / url。 */
export class DistilledQaWriteError extends Error {
  readonly code = 'notion_write_failed'
  constructor() {
    super('Notion write failed for a distilled QA candidate')
    this.name = 'DistilledQaWriteError'
  }
}

export interface DistilledQaWriter {
  /** 寫一條批准候選；回 Notion page id。失敗 throw DistilledQaWriteError。 */
  write(candidate: DistillCandidate, nowMs: number): Promise<string>
}

/** Notion rich_text 單段 2000 上限 — 防衛性留 buffer。 */
const TEXT_CAP = 1900

const text = (content: string) => [
  { type: 'text' as const, text: { content: content.slice(0, TEXT_CAP) } },
]

function candidateProperties(
  c: DistillCandidate,
  nowMs: number
): Record<string, unknown> {
  // modify ＝ Eric 改寫版為準；原候選答案進出處（approval.ts 承諾兩版都看得到）
  const answer =
    c.status === 'modified' && c.modifiedAnswer !== undefined
      ? c.modifiedAnswer
      : c.answer
  const provenance = [
    'LINE 夥伴群沉澱',
    `出處訊息 ${c.sourceMessageIds.length} 則：${c.sourceMessageIds.join(', ')}`,
    // 上游 parser 已 cap 500，這裡防衛性重申 — 出處 audit trail 不得被超長原答案擠掉
    ...(c.status === 'modified' ? [`原候選答案：${c.answer.slice(0, 500)}`] : []),
  ].join('｜')

  return {
    問題: { title: text(c.question) },
    答案: { rich_text: text(answer) },
    出處: { rich_text: text(provenance) },
    出現次數: { number: c.occurrences },
    // LINE 過目流程即晉升 — 入庫即已批准（候選/已略過留給未來變體）
    狀態: { select: { name: '已批准' } },
    收錄日期: { date: { start: new Date(nowMs).toISOString().slice(0, 10) } },
    // 地區/主題 multi-select 留空 — 刀2 LLM 不產分類，Notion 手動補標
  }
}

export function createDistilledQaWriter(deps: {
  sdk: DistilledQaSdkClient
  databaseId: string
}): DistilledQaWriter {
  let dataSourceId: string | null = null

  return {
    async write(candidate, nowMs) {
      try {
        if (dataSourceId === null) {
          const db = await deps.sdk.databases.retrieve({
            database_id: deps.databaseId,
          })
          const sources = Array.isArray(db?.data_sources) ? db.data_sources : []
          if (sources.length === 0) throw new DistilledQaWriteError()
          dataSourceId = sources[0].id
        }
        const page = await deps.sdk.pages.create({
          parent: { type: 'data_source_id', data_source_id: dataSourceId },
          properties: candidateProperties(candidate, nowMs),
        })
        return page.id
      } catch (error) {
        // 結構性失敗已是 sanitized error — 保留原 stack；其餘吞掉 raw SDK
        // error（可能夾 token / db id / url）→ fixed error
        if (error instanceof DistilledQaWriteError) throw error
        throw new DistilledQaWriteError()
      }
    },
  }
}
