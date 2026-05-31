import { createClient } from '@sanity/client'
import { evaluate, formatReport } from './article-lint.mjs'

/**
 * article-lint-all — 對所有「已發布」的 post 跑一次 article-lint，盤點哪些文章 FAIL。
 *
 * 只讀、不改任何東西。用來找出現役文章的 SEO/AEO 漏洞清單。
 * 沿用 article-lint.mjs 的純函式（evaluate / formatReport），這裡只負責抓資料 + 彙整。
 *
 *   node scripts/article-lint-all.mjs            # 只印每篇摘要 + 總表
 *   node scripts/article-lint-all.mjs --verbose  # 連每篇完整 FAIL/WARN 報告一起印
 */

const VERBOSE = process.argv.includes('--verbose')

// 與 article-lint.mjs 的 POST_QUERY 同欄位，但抓「全部已發布」的 post（排除 drafts.**）。
const ALL_POSTS_QUERY = `*[_type == "post" && !(_id in path("drafts.**"))]{
  title, "slug": slug.current, excerpt,
  "mainImage": mainImage{asset, alt},
  seoTitle, seoDescription, seoKeywords,
  body
} | order(slug asc)`

const client = createClient({
  projectId: 'xefjjue7',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
})

async function main() {
  let posts
  try {
    posts = await client.fetch(ALL_POSTS_QUERY)
  } catch (err) {
    console.error(`抓取 Sanity 失敗：${err && err.message ? err.message : err}`)
    process.exit(2)
  }

  if (!posts.length) {
    console.error('Sanity 裡找不到任何已發布的 post 文件')
    process.exit(2)
  }

  const rows = posts.map((post) => {
    const slug = post.slug || '(無 slug)'
    const r = evaluate(post)
    if (VERBOSE) console.log('\n' + formatReport(slug, r))
    return { slug, r }
  })

  // ── 總表：FAIL 的排最前，方便一眼看出待修清單 ──────────────
  rows.sort((a, b) => b.r.fails.length - a.r.fails.length)

  console.log('\n' + '═'.repeat(60))
  console.log(`📊 article-lint 全站盤點：${rows.length} 篇已發布文章`)
  console.log('═'.repeat(60))

  const failing = rows.filter((x) => !x.r.pass)
  const passing = rows.filter((x) => x.r.pass)

  console.log(`\n🔴 FAIL：${failing.length} 篇   🟢 PASS：${passing.length} 篇\n`)

  for (const { slug, r } of rows) {
    const mark = r.pass ? '🟢 PASS' : `🔴 FAIL(${r.fails.length})`
    const stars = `${'⭐'.repeat(r.rating.stars)} ${r.rating.grade}`
    console.log(`${mark}  ${stars}  SEO ${r.seo}/5 AEO ${r.aeo}/5  — ${slug}`)
    if (!r.pass) {
      for (const f of r.fails) console.log(`         ✗ ${f}`)
    }
  }

  console.log('')
  // 任一篇 FAIL → 非零退出，方便日後接 CI / 批次檢查。
  process.exit(failing.length ? 1 : 0)
}

main()
