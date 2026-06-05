import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const CASE_DIR = 'docs/ai-agent-knowledge/cases/itinerary-templates'
const CASE_FILES = [
  `${CASE_DIR}/chiang-mai-family-5d4n-classic.md`,
  `${CASE_DIR}/north-thailand-family-deep.md`,
]
const SOP_FILE = 'docs/ai-agent-knowledge/rules/itinerary-template-and-parser-format.md'
const NOTION_RAG_FILE = 'docs/ai-agent-knowledge/rules/notion-rag-sources.md'
const BACKLOG_FILE = `${CASE_DIR}/_source-backlog.md`

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function frontmatterOf(markdown: string): string {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  expect(match, 'file must start with YAML frontmatter').not.toBeNull()
  return match?.[1] ?? ''
}

function scalar(frontmatter: string, key: string): string {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
  return match?.[1]?.trim() ?? ''
}

describe('AI itinerary template knowledge files', () => {
  it('seed itinerary templates are parser-shaped and carry retrieval metadata', () => {
    for (const relativePath of CASE_FILES) {
      expect(fs.existsSync(path.join(ROOT, relativePath)), relativePath).toBe(true)

      const markdown = readProjectFile(relativePath)
      const frontmatter = frontmatterOf(markdown)

      expect(scalar(frontmatter, 'type')).toBe('itinerary_template')
      expect(scalar(frontmatter, 'parser_format')).toBe('customer_itinerary_v1')
      expect(scalar(frontmatter, 'source')).toBe('Eric_pasted_thread')
      expect(scalar(frontmatter, 'status')).toBe('draft')
      expect(scalar(frontmatter, 'last_reviewed')).toBe('2026-06-05')
      expect(frontmatter).toContain('themes:')
      expect(frontmatter).toContain('must_confirm:')

      expect(markdown).toContain('<套餐訂製>')
      expect(markdown).toContain('📅 日期：')
      expect(markdown).toContain('👨‍👩‍👧‍👦 人數：')
      expect(markdown).toMatch(/^Day 1｜.+$/m)
      expect(markdown).toContain('午餐：')
      expect(markdown).toContain('晚餐：')
      expect(markdown).toContain('・住宿：')
      expect(markdown).not.toContain('<報價>')

      const dayHeaders = markdown.match(/^Day \d+｜.+$/gm) ?? []
      expect(dayHeaders.length, `${relativePath} must include at least one Day header`).toBeGreaterThan(0)
      for (const [index, header] of dayHeaders.entries()) {
        expect(header).toMatch(new RegExp(`^Day ${index + 1}｜`))
      }
    }
  })

  it('SOP file records parser format, flight, market, vehicle, and luggage rules', () => {
    expect(fs.existsSync(path.join(ROOT, SOP_FILE)), SOP_FILE).toBe(true)

    const sop = readProjectFile(SOP_FILE)

    expect(sop).toContain('航班/第一天最後一天 SOP')
    expect(sop).toContain('市集/公休 SOP')
    expect(sop).toContain('車型/行李 SOP')
    expect(sop).toContain('報價解析格式 SOP')
    expect(sop).toContain('Toyota Commuter 10 人座 Van')
    expect(sop).toContain('Day X｜')
    expect(sop).toContain('午餐：')
    expect(sop).toContain('晚餐：')
    expect(sop).toContain('・住宿：')
    expect(sop).toContain('<報價>')
  })

  it('source backlog names unavailable cases instead of creating empty templates', () => {
    expect(fs.existsSync(path.join(ROOT, BACKLOG_FILE)), BACKLOG_FILE).toBe(true)

    const backlog = readProjectFile(BACKLOG_FILE)

    expect(backlog).toContain('source_status: missing_from_current_thread')
    for (const title of [
      '南邦 / 湄康蓬 / 茵他儂 3 日組合',
      '大象咖啡 / 南奔 / 湄康蓬包車案例',
      '芳縣我們家民宿 6 天案例',
      '大象 + 天使瀑布 + 清邁藍廟兩日遊',
      '經典清邁 6 天 5 夜親子行程',
      '年輕人大麻團 / 湄林山上案例',
      'J姊風格泰北遊 4-5 天案例',
      '清萊 2 天自由行',
    ]) {
      expect(backlog).toContain(title)
    }
  })

  it('Notion RAG source policy records private tables, dedupe, and ID hygiene', () => {
    expect(fs.existsSync(path.join(ROOT, NOTION_RAG_FILE)), NOTION_RAG_FILE).toBe(true)

    const policy = readProjectFile(NOTION_RAG_FILE)

    expect(policy).toContain('NOTION_TEAM_2026_DATABASE_ID')
    expect(policy).toContain('NOTION_PRIVATE_2025_DATABASE_ID')
    expect(policy).toContain('NOTION_PRIVATE_2026_DATABASE_ID')
    expect(policy).toContain('2026 團隊協作')
    expect(policy).toContain('2026 私人資料表')
    expect(policy).toContain('2025 私人資料表')
    expect(policy).toContain('2026 團隊協作裡面有的資料 = 2026 私人資料表也有')
    expect(policy).toContain('2025 私人資料表是 frozen / immutable')
    expect(policy).toContain('2026 私人資料表可能還會新增客人')
    expect(policy).toContain('RAG 檢索應優先用私人 2025/2026 做完整 traverse')
    expect(policy).toContain('第一層：markdown itinerary template library')
    expect(policy).toContain('第二層：Notion traverse 後存成我們自己的 RAG/index database')
    expect(policy).toContain('有空先完整 traverse 一次，再寫入內部索引庫方便整理與檢索')
    expect(policy).toContain('不要把成本、分潤、私人備註、Notion page URL、database ID 輸出到 partner group')
    expect(policy).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  })
})
