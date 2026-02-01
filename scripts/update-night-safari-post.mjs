// scripts/update-night-safari-post.mjs
// 執行方式: node --env-file=.env.local scripts/update-night-safari-post.mjs

import { createClient } from '@sanity/client'

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})

// 生成唯一 key
const key = () => Math.random().toString(36).substring(2, 12)

// 純文字區塊
const textBlock = (text, style = 'normal') => ({
  _type: 'block',
  _key: key(),
  style,
  children: [{ _type: 'span', _key: key(), text, marks: [] }],
  markDefs: [],
})

// 帶螢光標記的文字區塊
const highlightBlock = (beforeText, highlightText, afterText, style = 'normal') => {
  const highlightKey = key()
  return {
    _type: 'block',
    _key: key(),
    style,
    children: [
      ...(beforeText ? [{ _type: 'span', _key: key(), text: beforeText, marks: [] }] : []),
      { _type: 'span', _key: key(), text: highlightText, marks: ['highlight'] },
      ...(afterText ? [{ _type: 'span', _key: key(), text: afterText, marks: [] }] : []),
    ],
    markDefs: [],
  }
}

// 帶內部連結的文字區塊
const linkBlock = (beforeText, linkText, href, afterText, style = 'normal') => {
  const linkKey = key()
  return {
    _type: 'block',
    _key: key(),
    style,
    children: [
      ...(beforeText ? [{ _type: 'span', _key: key(), text: beforeText, marks: [] }] : []),
      { _type: 'span', _key: key(), text: linkText, marks: [linkKey] },
      ...(afterText ? [{ _type: 'span', _key: key(), text: afterText, marks: [] }] : []),
    ],
    markDefs: [
      {
        _type: 'link',
        _key: linkKey,
        href,
        blank: false,
      },
    ],
  }
}

// 表格區塊
const tableBlock = (caption, rows) => ({
  _type: 'tableBlock',
  _key: key(),
  caption,
  rows: rows.map((row) => ({
    _key: key(),
    cells: row.cells,
    isHeader: row.isHeader || false,
  })),
})

// 提示框
const tipBox = (type, content) => ({
  _type: 'tipBox',
  _key: key(),
  type,
  content,
})

// CTA 區塊
const ctaBlock = () => ({
  _type: 'ctaBlock',
  _key: key(),
  title: '需要行程規劃協助嗎？',
  description: '免費諮詢，讓在地人幫你規劃最適合的行程',
})

// 更新後的文章內容（加螢光標記 + 內部連結）
const body = [
  textBlock('清邁夜間動物園是帶小孩來清邁必去的景點之一。'),
  textBlock('但很多人只是「晚上到、搭遊園車、回家」，其實這樣玩只體驗到一半。'),
  textBlock('這篇告訴你怎麼安排時間，才能把夜間動物園玩得完整。'),

  // ▋園區介紹
  textBlock('清邁夜間動物園園區介紹｜三大區域解析', 'h2'),
  textBlock('清邁夜間動物園（Chiang Mai Night Safari）位於素帖山腳下，距離古城約 30 分鐘車程。'),
  textBlock('園區分成三個部分：'),
  tableBlock('', [
    { cells: ['區域', '內容', '時間'], isHeader: true },
    { cells: ['步行區', '長頸鹿、河馬等動物，可餵食體驗', '約 1 小時'] },
    { cells: ['遊園車（草食區）', '長頸鹿、斑馬近距離互動', '約 30 分鐘'] },
    { cells: ['遊園車（肉食區）', '獅子、老虎、花豹', '約 30 分鐘'] },
  ]),
  textBlock('園區還有幾個表演：舞蹈表演（18:10 開始）、老虎表演、水舞燈光秀。'),
  tipBox('tip', '表演時間可能調整，入園時先確認當天時刻表。'),
  textBlock('如果只搭遊園車，大概 1.5 小時就結束了。但如果從下午開始玩，可以待到 4-5 小時，體驗完全不同。'),

  // ▋最佳遊玩時間（加螢光）
  textBlock('最佳遊玩時間｜幾點去最好？', 'h2'),
  textBlock('這是我們配合的導遊給的建議，我自己兩次去都是晚上才到，只搭了遊園車。'),
  highlightBlock('雖然長頸鹿、斑馬近距離互動已經很精彩，但如果時間允許，', '16:30 抵達是最完整的玩法', '。'),
  textBlock('建議行程安排', 'h3'),
  tableBlock('', [
    { cells: ['時間', '活動'], isHeader: true },
    { cells: ['16:30', '抵達，走步行區、餵食體驗'] },
    { cells: ['18:10', '舞蹈表演（有人妖跳舞，氣氛熱鬧）'] },
    { cells: ['19:30', '搭遊園車（草食區＋肉食區）'] },
    { cells: ['20:30', '水舞燈光秀'] },
    { cells: ['21:00', '結束離園'] },
  ]),
  tipBox('tip', '每個表演的門票只能刷一次，不能重複進場，要先看好時間安排。'),

  // ▋門票價格（加螢光）
  textBlock('清邁夜間動物園門票價格｜現場買 vs 代訂', 'h2'),
  highlightBlock('先說重點：', '外國人現場買比較貴，建議先訂好票', '。'),
  textBlock('現場價格（外國人）', 'h3'),
  tableBlock('', [
    { cells: ['票種', '現場價（外國人）', '清微代訂'], isHeader: true },
    { cells: ['遊園車（成人）', '1,200 THB', '900 THB'] },
    { cells: ['遊園車（兒童 101-140cm）', '600 THB', '450 THB'] },
    { cells: ['100cm 以下', '免費', '免費'] },
    { cells: ['步行區（成人）', '400 THB', '—'] },
    { cells: ['步行區（兒童）', '200 THB', '—'] },
  ]),
  highlightBlock('', '清微代訂比 KKday、Klook 還便宜', '，電子 QR 票直接入場。'),
  textBlock('我們已經幫很多組客人訂過了，LINE 跟我說人數以及小朋友身高就可以處理。'),

  // ▋親子必看亮點（加螢光）
  textBlock('清邁夜間動物園親子必看亮點', 'h2'),
  textBlock('1. 遊園車近距離互動', 'h3'),
  textBlock('這是整個夜間動物園最精彩的部分。'),
  highlightBlock('搭上遊園車後，車子會慢慢開進動物區。', '長頸鹿會直接把頭探進車內，跟你面對面', '，小孩會興奮到尖叫。'),
  textBlock('斑馬也在路邊，距離非常近。大象也看得到，但稍微遠一點。'),
  textBlock('我帶過 2 歲和 6 歲的姪女去，兩個都超興奮，完全不會害怕。'),
  textBlock('晚上看動物不會恐怖，動物都在開放區域，有安全距離，氣氛反而很神秘有趣。'),

  textBlock('2. 水舞燈光秀', 'h3'),
  textBlock('晚上可以看的表演。'),
  textBlock('水柱搭配五彩燈光，畫面很漂亮，很適合拍照打卡。'),

  textBlock('3. 舞蹈表演', 'h3'),
  textBlock('入園後的開場表演，有人妖跳舞，氣氛熱鬧，可以當作暖場。'),

  // ▋帶小孩注意事項（加螢光）
  textBlock('帶小孩去清邁夜間動物園注意事項', 'h2'),
  textBlock('最佳年齡', 'h3'),
  highlightBlock('', '2 歲以上最能享受', '。會有反應、會興奮、會記得這個體驗。'),
  textBlock('嬰兒可以帶嗎？', 'h3'),
  textBlock('可以。'),
  textBlock('雖然還不會表達，但這個年紀正是開始探索世界的時候，光是看著動物的形狀、聽著聲音，都在累積他們的想像力。'),
  textBlock('我女兒當時 11 個月，全程睜大眼睛看，回家後翻動物繪本還會特別盯著長頸鹿。'),
  textBlock('會不會害怕？', 'h3'),
  textBlock('不會。'),
  textBlock('我帶過 2 歲和 6 歲的小孩，晚上看動物反而覺得很新奇，不會有恐怖的感覺。'),
  textBlock('遊園車有欄杆，動物不會真的跑進來，但距離近到可以摸到長頸鹿的頭。'),
  textBlock('天氣', 'h3'),
  textBlock('晚上去的好處是不會熱。'),
  textBlock('清邁白天很曬，但傍晚之後氣溫舒服很多，帶小孩逛起來輕鬆。'),
  textBlock('要帶什麼？', 'h3'),
  textBlock('• 防蚊液（戶外還是有蚊子）'),
  textBlock('• 薄外套（晚上山區會涼）'),
  textBlock('• 相機/手機（一定會想拍）'),

  // ▋交通方式（加內部連結）
  textBlock('清邁夜間動物園交通方式', 'h2'),
  textBlock('夜間動物園在素帖山腳下，距離古城約 12 公里。'),
  textBlock('去程', 'h3'),
  textBlock('包車最方便。如果當天還有其他行程（素帖寺、雙龍寺），司機可以一起安排，看完動物園直接去吃晚餐或回飯店。'),
  textBlock('也可以用 Grab 叫車，單程約 200-300 THB。'),
  linkBlock('想了解更多交通方式？可以參考這篇 ', '清邁交通攻略｜包車 vs Grab vs 雙條車怎麼選？', '/blog/chiang-mai-transportation-guide', ''),
  textBlock('回程', 'h3'),
  textBlock('園區外有雙條車可以搭回市區，價格大約 300-400 THB，可以試著殺價。'),
  textBlock('Grab 應該也可以叫，但我們都是自己開車，沒實測過等車時間。'),
  textBlock('如果是包車來的，司機會在外面等，最省事。'),

  // ▋常見問題 FAQ
  textBlock('清邁夜間動物園常見問題 FAQ', 'h2'),
  textBlock('清邁夜間動物園幾點去最好？', 'h3'),
  textBlock('建議 16:30 抵達。可以先走步行區、看表演，再搭遊園車，行程最完整。'),
  textBlock('如果只想搭遊園車，18:00 之後到也可以。'),

  textBlock('門票要先買還是現場買？', 'h3'),
  textBlock('建議先買。現場外國人價格比較貴（遊園車成人 1,200 THB），代訂或線上買都比較划算。'),

  textBlock('小孩會不會害怕夜間動物園？', 'h3'),
  textBlock('不會。動物都在開放區域，有安全距離，晚上的氣氛反而很有探險感。我帶過 2 歲的小孩，全程都很興奮。'),

  textBlock('遊園車和步行區差在哪？', 'h3'),
  textBlock('遊園車是坐車看動物，會經過草食區和肉食區，長頸鹿會把頭探進車內互動。'),
  textBlock('步行區是自己走，可以餵食小動物，適合有時間慢慢逛的人。'),

  textBlock('夜間動物園需要停留多久？', 'h3'),
  textBlock('• 只搭遊園車：約 1.5 小時'),
  textBlock('• 完整體驗（步行區＋表演＋遊園車）：約 4-5 小時'),

  textBlock('可以自己帶食物餵動物嗎？', 'h3'),
  textBlock('不行，園區內有賣餵食的飼料，要用園區提供的才安全。'),

  // ▋結語
  textBlock('結語', 'h2'),
  textBlock('清邁夜間動物園是少數可以讓小孩「近距離接觸動物」的地方。'),
  highlightBlock('', '長頸鹿把頭探進車內的那一刻，小孩的表情絕對值回票價。', ''),
  textBlock('如果你正在規劃清邁親子行程，這裡很推薦排進去。'),

  // CTA
  ctaBlock(),
]

async function updatePost() {
  console.log('正在更新文章...')

  if (!process.env.SANITY_API_TOKEN) {
    console.error('❌ 缺少 SANITY_API_TOKEN')
    process.exit(1)
  }

  try {
    // 找到文章
    const query = `*[_type == "post" && slug.current == "chiang-mai-night-safari-guide"][0]{ _id }`
    const post = await client.fetch(query)

    if (!post) {
      console.error('❌ 找不到文章')
      process.exit(1)
    }

    console.log('找到文章 ID:', post._id)

    // 更新文章內容
    const result = await client.patch(post._id).set({ body }).commit()

    console.log('')
    console.log('✅ 文章更新成功！')
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('更新內容：')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('1. ✨ 螢光標記：')
    console.log('   - 16:30 抵達是最完整的玩法')
    console.log('   - 外國人現場買比較貴，建議先訂好票')
    console.log('   - 清微代訂比 KKday、Klook 還便宜')
    console.log('   - 長頸鹿會直接把頭探進車內')
    console.log('   - 2 歲以上最能享受')
    console.log('   - 長頸鹿把頭探進車內...值回票價')
    console.log('')
    console.log('2. 🔗 內部連結：')
    console.log('   - 連結到「清邁交通攻略」')
    console.log('')
    console.log('3. 📝 H2 標題優化：')
    console.log('   - 加入「清邁夜間動物園」關鍵字')
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📝 請到網站確認效果：')
    console.log('https://chiangway-travel.com/blog/chiang-mai-night-safari-guide')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } catch (error) {
    console.error('❌ 更新失敗:', error.message)
  }
}

updatePost()
