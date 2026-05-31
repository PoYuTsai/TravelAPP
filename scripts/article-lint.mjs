import { fileURLToPath } from 'node:url'
import { realpathSync } from 'node:fs'

/**
 * article-lint — 發布前對 Sanity `post` 文件跑客觀檢核閘門。
 * FAIL 擋發布、WARN 提醒，最後印出對齊現有「⭐ A/B/C/D」評級。
 *
 * 設計文件：docs/plans/2026-05-31-article-lint-design.md
 * 純函式（extractText / countWords / countQuestions / scanBanned / hasFaq /
 * rate / evaluate）皆 export，單元測試見 article-lint.test.mjs。
 * Sanity 抓取 + CLI 在檔尾，只有「直接執行」時才跑，import 不觸發。
 */

// ── §6 禁用詞 / 句型清單（持續長大，集中在這裡好維護）──────────
export const BANNED = {
  // FAIL — 固定詞，近乎零誤判的 AI 味
  fail: [
    '總而言之', '綜上所述', '總的來說', '綜合以上', '不難看出', '眾所周知',
    '最專業', '最優質', '最頂級', '業界第一', '第一品牌',
    '在這篇文章中', '本文將', '我們將為您介紹',
  ],
  // WARN — 高誤判風險的詞（正常句也會用，提醒即可）
  warn: ['最佳', '最便宜', '最豪華', 'No.1', '最好的'],
  // WARN — AI 味「句型」（Eric 會陸續補）
  warnPatterns: [
    { label: '不是…而是…', re: /不是.{1,20}[，,]?而是/ },
    { label: '與其說…不如說…', re: /與其說.{1,20}不如說/ },
    { label: '不僅僅是…更是…', re: /不僅僅?是.{1,20}更是/ },
    { label: '在這個…的時代', re: /在這個.{1,12}的時代/ },
    { label: '讓我們一起…', re: /讓我們一起/ },
  ],
}

// ── §4 body（Portable Text）文字抽取 ────────────────────────
const stripLen = (s) => [...String(s).replace(/\s/g, '')].length

/** 抽出計入「內容字數」的純文字：block spans + tipBox.content + tableBlock 儲存格；ctaBlock/圖片/影片不算。 */
export function extractText(body = []) {
  const parts = []
  for (const node of body || []) {
    if (!node || typeof node !== 'object') continue
    if (node._type === 'block') {
      for (const child of node.children || []) {
        if (child && typeof child.text === 'string') parts.push(child.text)
      }
    } else if (node._type === 'tipBox') {
      if (node.content) parts.push(node.content)
    } else if (node._type === 'tableBlock') {
      for (const row of node.rows || []) {
        for (const cell of row.cells || []) {
          if (typeof cell === 'string') parts.push(cell)
        }
      }
    }
    // ctaBlock / image / videoBlock / toursBlock → 不計文字
  }
  return parts.join('\n')
}

/** 中文字數：去空白後的字元（code point）數。 */
export function countWords(text = '') {
  return stripLen(text)
}

/** 問號數（全形＋半形）。 */
export function countQuestions(text = '') {
  return (String(text).match(/[？?]/g) || []).length
}

/** 掃禁用詞／句型，回 { fail, warn, patterns }（皆為命中的標籤陣列）。 */
export function scanBanned(text = '') {
  const s = String(text)
  return {
    fail: BANNED.fail.filter((w) => s.includes(w)),
    warn: BANNED.warn.filter((w) => s.includes(w)),
    patterns: BANNED.warnPatterns.filter((p) => p.re.test(s)).map((p) => p.label),
  }
}

const headingText = (node) => (node.children || []).map((c) => c.text || '').join('')

/** 是否存在 H2「常見問題」或「FAQ」段落。 */
export function hasFaq(body = []) {
  return (body || []).some(
    (n) => n && n._type === 'block' && n.style === 'h2' && /常見問題|FAQ/i.test(headingText(n)),
  )
}

/** 螢光標記（highlight decorator）的 span 數。 */
export function countHighlights(body = []) {
  let n = 0
  for (const node of body || []) {
    if (node && node._type === 'block') {
      for (const c of node.children || []) {
        if ((c.marks || []).includes('highlight')) n++
      }
    }
  }
  return n
}

/** 提示框（tipBox）數量。 */
export function countTipBoxes(body = []) {
  return (body || []).filter((n) => n && n._type === 'tipBox').length
}

/** 內文圖：{ total, missingAlt }。 */
export function countBodyImages(body = []) {
  const imgs = (body || []).filter((n) => n && n._type === 'image')
  return {
    total: imgs.length,
    missingAlt: imgs.filter((n) => !n.alt || !String(n.alt).trim()).length,
  }
}

/** 標題層級是否跳級（如 H2 後直接 H4）。 */
export function hasHeadingJump(body = []) {
  const levels = []
  for (const n of body || []) {
    if (n && n._type === 'block' && /^h[234]$/.test(n.style || '')) {
      levels.push(Number(n.style[1]))
    }
  }
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) return true
  }
  return false
}

// ── §7 評級：SEO+AEO（各 /5）→ ⭐ A/B/C/D ───────────────────
const STARS = { A: 5, B: 4, C: 3, D: 2 }

/** 由 SEO/AEO 分數算總分、級別、星數、是否高價值。 */
export function rate(seo, aeo) {
  const score = seo + aeo
  let grade
  if (score >= 9) grade = 'A'
  else if (score >= 7) grade = 'B'
  else if (score >= 5) grade = 'C'
  else grade = 'D'
  return { seo, aeo, score, grade, stars: STARS[grade], highValue: seo >= 4 && aeo >= 3 }
}

// ── §5 組裝 FAIL / WARN + 評級 ─────────────────────────────
/** 對一份 post（已照 §2 GROQ 抓好欄位）做完整檢核。 */
export function evaluate(post = {}) {
  const body = post.body || []
  const text = extractText(body)
  const wordCount = countWords(text)
  const questions = countQuestions(text)
  const banned = scanBanned(text)
  const faq = hasFaq(body)
  const highlights = countHighlights(body)
  const tipBoxes = countTipBoxes(body)
  const imgs = countBodyImages(body)
  const headingJump = hasHeadingJump(body)

  const effTitle = String(post.seoTitle || post.title || '').trim()
  const effDesc = String(post.seoDescription || post.excerpt || '').trim()
  const titleLen = [...effTitle].length
  const descLen = stripLen(effDesc)
  const keywords = post.seoKeywords || []
  const cover = post.mainImage
  const coverAlt = cover && cover.alt && String(cover.alt).trim()

  const fails = []
  const warns = []

  // 🔴 FAIL
  for (const w of banned.fail) {
    const hits = text.split(w).length - 1
    fails.push(`禁用詞「${w}」出現在內文（${hits} 處）`)
  }
  if (wordCount < 1500) fails.push(`字數 ${wordCount} 不足 1500`)
  if (!faq) fails.push('找不到「常見問題/FAQ」H2 段落')
  if (questions < 5) fails.push(`問號只有 ${questions} 個（至少 5）`)
  if (!effTitle) fails.push('SEO 標題缺（seoTitle 與 title 都空）')
  else if (titleLen > 60) fails.push(`SEO 標題 ${titleLen} 字超過 60`)
  if (!effDesc) fails.push('SEO 描述缺（seoDescription 與 excerpt 都空）')
  else if (descLen < 120 || descLen > 160) fails.push(`SEO 描述 ${descLen} 字不在 120-160`)
  if (keywords.length < 5) fails.push(`SEO 關鍵字只有 ${keywords.length} 個（至少 5）`)
  if (!cover) fails.push('封面圖 mainImage 缺')
  else if (!coverAlt) fails.push('封面圖缺 alt')

  // 🟡 WARN
  if (wordCount >= 1500 && wordCount < 2000) warns.push(`字數 ${wordCount}（建議 2000+）`)
  if (questions >= 5 && questions < 8) warns.push(`問號 ${questions} 個（建議 8+）`)
  if (highlights < 3) warns.push(`螢光標記只有 ${highlights} 處（建議 ≥3）`)
  if (tipBoxes < 1) warns.push('沒有提示框（建議 ≥1）')
  if (imgs.total < 3) warns.push(`內文圖只有 ${imgs.total} 張（建議 ≥3）`)
  else if (imgs.missingAlt > 0) warns.push(`有 ${imgs.missingAlt} 張內文圖缺 alt`)
  if (headingJump) warns.push('H2/H3 標題層級出現跳級')
  for (const w of banned.warn) warns.push(`可能 AI 味用詞「${w}」（請複查）`)
  for (const p of banned.patterns) warns.push(`可能 AI 味句型「${p}」（請複查）`)

  // SEO / AEO 各 5 項（達標得 1 分）
  const seo = [
    !!effTitle && titleLen <= 60,
    !!effDesc && descLen >= 120 && descLen <= 160,
    keywords.length >= 5,
    !!cover && !!coverAlt,
    wordCount >= 1500,
  ].filter(Boolean).length
  const aeo = [
    faq,
    questions >= 8,
    tipBoxes >= 1,
    highlights >= 3,
    imgs.total >= 3 && imgs.missingAlt === 0,
  ].filter(Boolean).length

  return { fails, warns, seo, aeo, rating: rate(seo, aeo), pass: fails.length === 0 }
}

// ── §7 輸出格式 ───────────────────────────────────────────
const DIVIDER = '────────────────────────'

/** 把 evaluate() 結果排成對齊設計文件 §7 的報告字串。 */
export function formatReport(slug, r) {
  const lines = [`📋 article-lint: ${slug}`, DIVIDER, `🔴 FAIL (${r.fails.length})`]
  for (const f of r.fails) lines.push(`  ✗ ${f}`)
  lines.push(`🟡 WARN (${r.warns.length})`)
  for (const w of r.warns) lines.push(`  ⚠ ${w}`)
  lines.push(DIVIDER)
  lines.push(`SEO 檢核 ${r.seo}/5 ｜ AEO 檢核 ${r.aeo}/5`)
  lines.push(
    `評級：${'⭐'.repeat(r.rating.stars)} ${r.rating.grade}（${r.rating.score} 分）` +
      (r.rating.highValue ? ' · 高價值' : ''),
  )
  lines.push(
    r.pass ? '結果：PASS — 可發布 ✅' : `結果：FAIL — 修正上面 ${r.fails.length} 項紅燈再發布`,
  )
  return lines.join('\n')
}

// ── §2 Sanity 抓取 + CLI（IO 層；只在直接執行時跑）─────────────
const POST_QUERY = `*[_type == "post" && slug.current == $slug][0]{
  title, "slug": slug.current, excerpt,
  "mainImage": mainImage{asset, alt},
  seoTitle, seoDescription, seoKeywords,
  body
}`

async function main() {
  const slug = process.argv[2]
  if (!slug) {
    console.error('用法：node scripts/article-lint.mjs <slug>')
    process.exit(2)
  }

  let post
  try {
    const { createClient } = await import('@sanity/client')
    const client = createClient({
      projectId: 'xefjjue7',
      dataset: 'production',
      apiVersion: '2024-01-01',
      useCdn: false,
    })
    post = await client.fetch(POST_QUERY, { slug })
  } catch (err) {
    console.error(`抓取 Sanity 失敗：${err && err.message ? err.message : err}`)
    process.exit(2)
  }

  if (!post) {
    console.error(`找不到 slug 為「${slug}」的 post 文件`)
    process.exit(2)
  }

  const result = evaluate(post)
  console.log(formatReport(slug, result))
  process.exit(result.pass ? 0 : 1)
}

// 被 import（測試）時不觸發；只有 `node article-lint.mjs ...` 直接執行才跑。
const invokedDirectly =
  process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main()
}
