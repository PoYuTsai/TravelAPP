import { describe, test, expect } from 'vitest'
import {
  extractText,
  countWords,
  countQuestions,
  scanBanned,
  hasFaq,
  rate,
  evaluate,
  formatReport,
} from './article-lint.mjs'

// ── Portable Text 測試夾具 ────────────────────────────
const block = (text, style = 'normal', marks = []) => ({
  _type: 'block',
  style,
  children: [{ _type: 'span', text, marks }],
})
const tipBox = (content) => ({ _type: 'tipBox', type: 'tip', content })
const image = (alt) => ({ _type: 'image', alt })
const ctaBlock = () => ({ _type: 'ctaBlock', title: '需要協助嗎', description: '免費諮詢' })
const tableBlock = (...cells) => ({
  _type: 'tableBlock',
  rows: [{ cells, isHeader: false }],
})

// 造一篇「字數足夠且結構完整」的及格 post，個別測試再覆寫欄位
function goodPost(overrides = {}) {
  const body = [
    block('清邁親子包車的完整介紹。' + '內容'.repeat(800)), // 充足字數
    block('常見問題', 'h2'),
    block('要帶幾歲的小孩呢？適合嗎？要準備什麼？費用怎麼算？可以改行程嗎？多久前要訂？', 'normal'),
    block('重點提醒', 'normal', ['highlight']),
    block('再一個重點', 'normal', ['highlight']),
    block('第三個重點', 'normal', ['highlight']),
    tipBox('記得帶防曬'),
    image('清邁古城照片'),
    image('夜間動物園照片'),
    image('週日夜市照片'),
  ]
  return {
    title: '清邁親子包車完整攻略',
    slug: 'chiang-mai-family',
    excerpt: '一篇文章',
    mainImage: { asset: { _ref: 'image-abc' }, alt: '清邁封面' },
    seoTitle: '清邁親子包車完整攻略｜在地爸媽帶你玩',
    seoDescription: '字'.repeat(140),
    seoKeywords: ['清邁', '親子', '包車', '自由行', '導遊'],
    body,
    ...overrides,
  }
}

describe('extractText', () => {
  test('抽取 block children 文字', () => {
    const body = [block('你好'), block('世界', 'h2')]
    expect(extractText(body)).toContain('你好')
    expect(extractText(body)).toContain('世界')
  })

  test('包含 tipBox.content 與 tableBlock 儲存格，排除 ctaBlock', () => {
    const body = [
      block('正文'),
      tipBox('提示內容'),
      tableBlock('表格欄一', '表格欄二'),
      ctaBlock(),
    ]
    const text = extractText(body)
    expect(text).toContain('提示內容')
    expect(text).toContain('表格欄一')
    expect(text).toContain('表格欄二')
    expect(text).not.toContain('需要協助嗎')
    expect(text).not.toContain('免費諮詢')
  })

  test('圖片/影片不計入文字', () => {
    const body = [block('正文'), image('圖片描述')]
    expect(extractText(body)).not.toContain('圖片描述')
  })
})

describe('countWords', () => {
  test('中文去空白後算字元數', () => {
    expect(countWords('你好 世界')).toBe(4)
  })
  test('空字串為 0', () => {
    expect(countWords('')).toBe(0)
  })
})

describe('countQuestions', () => {
  test('全形與半形問號都算', () => {
    expect(countQuestions('真的嗎？是的? 好嗎？')).toBe(3)
  })
})

describe('scanBanned', () => {
  test('FAIL 禁用詞命中', () => {
    expect(scanBanned('總而言之，這趟很棒').fail).toContain('總而言之')
  })

  test('誤判防護：「最適合小小孩」不命中 FAIL', () => {
    const r = scanBanned('這個行程最適合小小孩')
    expect(r.fail).toHaveLength(0)
  })

  test('WARN 詞命中：「最佳」', () => {
    expect(scanBanned('這是最佳選擇').warn).toContain('最佳')
  })

  test('WARN 句型命中：「不是…而是…」', () => {
    expect(scanBanned('不是貴，而是值得').patterns.length).toBeGreaterThan(0)
  })

  test('正常句不誤觸句型', () => {
    expect(scanBanned('我們提供清邁包車服務').patterns).toHaveLength(0)
  })
})

describe('hasFaq', () => {
  test('有 H2「常見問題」→ true', () => {
    expect(hasFaq([block('常見問題', 'h2')])).toBe(true)
  })
  test('有 H2「FAQ」→ true', () => {
    expect(hasFaq([block('FAQ', 'h2')])).toBe(true)
  })
  test('「常見問題」只是內文非 H2 → false', () => {
    expect(hasFaq([block('常見問題', 'normal')])).toBe(false)
  })
  test('完全沒有 → false', () => {
    expect(hasFaq([block('正文', 'h2')])).toBe(false)
  })
})

describe('rate', () => {
  test('SEO 4 + AEO 3 → 高價值、B 級（7 分）', () => {
    const r = rate(4, 3)
    expect(r.score).toBe(7)
    expect(r.grade).toBe('B')
    expect(r.highValue).toBe(true)
  })
  test('SEO 3 + AEO 3 → C 級（6 分）、非高價值', () => {
    const r = rate(3, 3)
    expect(r.grade).toBe('C')
    expect(r.stars).toBe(3)
    expect(r.highValue).toBe(false)
  })
  test('9 分以上為 A', () => {
    expect(rate(5, 4).grade).toBe('A')
  })
  test('低於 5 分為 D', () => {
    expect(rate(2, 2).grade).toBe('D')
  })
})

describe('evaluate — 字數邊界', () => {
  // 總抽取字數剛好 = n（FAQ h2 4 字 + 5 個問號 = 9 字固定開銷）
  const wordBody = (n) => [block('字'.repeat(n - 9)), block('常見問題', 'h2'), block('？？？？？')]
  test('1499 字 → FAIL', () => {
    const r = evaluate(goodPost({ body: wordBody(1499) }))
    expect(r.fails.some((f) => f.includes('字數'))).toBe(true)
  })
  test('1500 字 → 字數不 FAIL', () => {
    const r = evaluate(goodPost({ body: wordBody(1500) }))
    expect(r.fails.some((f) => f.includes('字數'))).toBe(false)
  })
  test('1999 字 → 字數 WARN', () => {
    const r = evaluate(goodPost({ body: wordBody(1999) }))
    expect(r.warns.some((w) => w.includes('字數'))).toBe(true)
  })
})

describe('evaluate — SEO Description 邊界', () => {
  const mk = (len) => goodPost({ seoDescription: '字'.repeat(len) })
  test('119 字 → FAIL', () => {
    expect(evaluate(mk(119)).fails.some((f) => f.includes('描述'))).toBe(true)
  })
  test('120 字 → pass', () => {
    expect(evaluate(mk(120)).fails.some((f) => f.includes('描述'))).toBe(false)
  })
  test('160 字 → pass', () => {
    expect(evaluate(mk(160)).fails.some((f) => f.includes('描述'))).toBe(false)
  })
  test('161 字 → FAIL', () => {
    expect(evaluate(mk(161)).fails.some((f) => f.includes('描述'))).toBe(true)
  })
})

describe('evaluate — fallback 與結構', () => {
  test('seoDescription 空時 fallback 用 excerpt', () => {
    const post = goodPost({ seoDescription: undefined, excerpt: '字'.repeat(140) })
    expect(evaluate(post).fails.some((f) => f.includes('描述'))).toBe(false)
  })
  test('描述與 excerpt 都空 → FAIL', () => {
    const post = goodPost({ seoDescription: undefined, excerpt: undefined })
    expect(evaluate(post).fails.some((f) => f.includes('描述'))).toBe(true)
  })
  test('找不到 FAQ → FAIL', () => {
    const body = goodPost().body.filter((b) => !(b.style === 'h2'))
    expect(evaluate(goodPost({ body })).fails.some((f) => f.includes('FAQ') || f.includes('常見問題'))).toBe(true)
  })
  test('封面缺 alt → FAIL', () => {
    const post = goodPost({ mainImage: { asset: { _ref: 'x' } } })
    expect(evaluate(post).fails.some((f) => f.includes('封面'))).toBe(true)
  })
  test('Keywords < 5 → FAIL', () => {
    const post = goodPost({ seoKeywords: ['清邁', '親子'] })
    expect(evaluate(post).fails.some((f) => f.includes('關鍵字') || f.includes('Keywords'))).toBe(true)
  })
})

describe('evaluate — 完整及格文章', () => {
  test('goodPost 無 FAIL 且 pass', () => {
    const r = evaluate(goodPost())
    expect(r.fails).toHaveLength(0)
    expect(r.pass).toBe(true)
  })
})

describe('formatReport', () => {
  test('FAIL 文章：印出 slug、FAIL 行、評級、FAIL 結論', () => {
    const r = evaluate(goodPost({ seoKeywords: ['清邁'] })) // 只有 1 個關鍵字 → FAIL
    const out = formatReport('night-safari', r)
    expect(out).toContain('article-lint: night-safari')
    expect(out).toContain('SEO 關鍵字')
    expect(out).toMatch(/評級：.+[ABCD]/)
    expect(out).toContain('FAIL')
  })
  test('及格文章：印出 PASS 結論', () => {
    const out = formatReport('chiang-mai-family', evaluate(goodPost()))
    expect(out).toContain('PASS')
  })
})
