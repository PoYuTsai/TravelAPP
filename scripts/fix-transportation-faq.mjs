// scripts/fix-transportation-faq.mjs
// 只修正交通攻略的 Q5-Q8 FAQ 格式，不動其他內容
// 執行方式: node --env-file=.env.local scripts/fix-transportation-faq.mjs

import { createClient } from '@sanity/client'

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})

const key = () => Math.random().toString(36).substring(2, 12)

// H3 + 粗體的問題區塊
const questionBlock = (text) => ({
  _type: 'block',
  _key: key(),
  style: 'h3',
  children: [{ _type: 'span', _key: key(), text, marks: ['strong'] }],
  markDefs: [],
})

// Normal 的答案區塊
const answerBlock = (text) => ({
  _type: 'block',
  _key: key(),
  style: 'normal',
  children: [{ _type: 'span', _key: key(), text, marks: [] }],
  markDefs: [],
})

// 正確格式的 Q5-Q8
const fixedFaqBlocks = [
  questionBlock('Q5: 清邁有 Uber 嗎？'),
  answerBlock('A: 沒有，Uber 已經退出泰國市場。現在主流是 Grab 和 Bolt，功能差不多，建議兩個都裝，比價叫車。'),
  questionBlock('Q6: 雙條車可以講價嗎？'),
  answerBlock('A: 可以，但要看情況。觀光區（尼曼路、古城）司機比較硬，郊區或人少時比較好談。建議先問價再上車，避免糾紛。'),
  questionBlock('Q7: 帶嬰兒推車方便嗎？'),
  answerBlock('A: 不太方便。雙條車要自己抬上去，Grab 後車廂不一定放得下。包車最方便，司機會幫忙搬。'),
  questionBlock('Q8: 清邁機場到市區要多久？'),
  answerBlock('A: 正常 20-30 分鐘，塞車時 30-40 分鐘。通常長榮或華航接機約為 10:30 左右抵達，出關領完行李約 11:00。'),
]

async function fixFaq() {
  console.log('🔍 讀取文章...')

  const post = await client.fetch(`*[_type == "post" && slug.current == "chiang-mai-transportation"][0]{
    _id,
    body
  }`)

  if (!post) {
    console.log('❌ 找不到文章')
    return
  }

  const body = post.body

  // 找到 Q5 開始的位置 (index 89) 和結語的位置 (index 94)
  let q5Index = -1
  let conclusionIndex = -1

  body.forEach((block, i) => {
    if (block._type === 'block' && block.children?.[0]?.text) {
      const text = block.children[0].text
      if (text.includes('Q5:') && text.includes('Uber')) {
        q5Index = i
      }
      if (block.style === 'h2' && text === '結語') {
        conclusionIndex = i
      }
    }
  })

  console.log('📍 Q5 位置:', q5Index)
  console.log('📍 結語位置:', conclusionIndex)

  if (q5Index === -1 || conclusionIndex === -1) {
    console.log('❌ 找不到 Q5 或結語位置')
    return
  }

  // 組合新的 body：
  // 1. 保留 Q5 之前的所有內容 (index 0 到 q5Index-1)
  // 2. 插入修正後的 Q5-Q8
  // 3. 保留結語之後的所有內容 (index conclusionIndex 到最後)

  const newBody = [
    ...body.slice(0, q5Index),           // Q5 之前的所有內容
    ...fixedFaqBlocks,                    // 修正後的 Q5-Q8
    ...body.slice(conclusionIndex),       // 結語及之後的內容
  ]

  console.log('📊 原本 body 長度:', body.length)
  console.log('📊 新的 body 長度:', newBody.length)
  console.log('📊 被替換的區塊數:', conclusionIndex - q5Index)
  console.log('📊 新的 FAQ 區塊數:', fixedFaqBlocks.length)

  // 確認要執行
  console.log('\n⚠️  即將更新文章，以下內容會被保留：')
  console.log('   - Q5 之前的所有內容（含 Q1-Q4）')
  console.log('   - 結語及之後的內容')
  console.log('   - 所有圖片、影片、提示框')
  console.log('\n⚠️  以下內容會被替換：')
  console.log('   - Q5-Q8（修正格式）')

  // 執行更新
  console.log('\n🚀 開始更新...')

  await client
    .patch(post._id)
    .set({ body: newBody })
    .commit()

  console.log('✅ 更新完成！')
  console.log('\n修正內容：')
  console.log('   - Q5: 清邁有 Uber 嗎？ (H3+粗體)')
  console.log('   - Q6: 雙條車可以講價嗎？ (H3+粗體)')
  console.log('   - Q7: 帶嬰兒推車方便嗎？ (H3+粗體)')
  console.log('   - Q8: 清邁機場到市區要多久？ (H3+粗體)')
}

fixFaq().catch(console.error)
