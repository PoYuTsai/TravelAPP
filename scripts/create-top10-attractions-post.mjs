// scripts/create-top10-attractions-post.mjs
// 清邁親子景點 TOP 10 文章上傳腳本
// 執行方式: node --env-file=.env.local scripts/create-top10-attractions-post.mjs

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

// 一般文字區塊
const textBlock = (text, style = 'normal') => ({
  _type: 'block',
  _key: key(),
  style,
  children: [{ _type: 'span', _key: key(), text, marks: [] }],
  markDefs: [],
})

// 粗體文字區塊
const boldTextBlock = (text, style = 'normal') => ({
  _type: 'block',
  _key: key(),
  style,
  children: [{ _type: 'span', _key: key(), text, marks: ['strong'] }],
  markDefs: [],
})

// 混合文字區塊（部分粗體、部分螢光）
const mixedTextBlock = (segments, style = 'normal') => {
  const markDefs = []
  const children = segments.map((seg) => {
    const marks = []
    if (seg.bold) marks.push('strong')
    if (seg.highlight) marks.push('highlight')
    if (seg.link) {
      const linkKey = key()
      markDefs.push({
        _type: 'link',
        _key: linkKey,
        href: seg.link,
        blank: false,
      })
      marks.push(linkKey)
    }
    return { _type: 'span', _key: key(), text: seg.text, marks }
  })
  return {
    _type: 'block',
    _key: key(),
    style,
    children,
    markDefs,
  }
}

// H3 + 粗體（FAQ 問題格式）
const questionBlock = (text) => ({
  _type: 'block',
  _key: key(),
  style: 'h3',
  children: [{ _type: 'span', _key: key(), text, marks: ['strong'] }],
  markDefs: [],
})

// 提示框
const tipBox = (type, content) => ({
  _type: 'tipBox',
  _key: key(),
  type,
  content,
})

// 文章內容
const body = [
  // 開頭
  textBlock('住在清邁的台灣爸爸，整理出 10 個真正適合帶小孩去的景點。'),
  textBlock('不是網路複製貼上，是我們自己帶女兒去過、或導遊實際帶客人去過的地方。按「動物互動」「戶外放電」「室內雨備」分類，讓你快速找到適合的行程。'),

  // ▋動物互動類
  textBlock('動物互動類', 'h2'),
  textBlock('帶小孩來清邁，動物體驗絕對是重頭戲。這裡整理 5 個我們實際去過、客人回饋最好的景點。'),

  // 1. 夜間動物園
  textBlock('1. 清邁夜間動物園（Chiang Mai Night Safari）', 'h3'),
  textBlock('亞洲最大的夜間動物園，也是清邁親子遊的經典必去。'),
  mixedTextBlock([
    { text: '搭遊園車穿越園區，長頸鹿會把頭探進車廂、斑馬就在身旁走過。小孩拿紅蘿蔔餵食的時候，' },
    { text: '長頸鹿的舌頭超～長，第一次餵的小孩通常會嚇一跳然後笑出來。', bold: true, highlight: true },
  ]),
  textBlock('建議傍晚 5 點左右入園，先逛步行區看小動物，6 點半開始搭遊園車剛好天黑。'),
  textBlock('📍 門票： 成人 1,200฿，兒童 600฿'),
  textBlock('⏰ 建議停留： 3-4 小時'),
  mixedTextBlock([
    { text: '👉 詳細攻略： ' },
    { text: '清邁夜間動物園完整攻略', link: '/blog/chiang-mai-night-safari' },
  ]),
  textBlock('📷 [影片：夜間動物園精彩片段]'),

  // 2. 大象體驗
  textBlock('2. 大象體驗', 'h3'),
  textBlock('來清邁不體驗大象，真的太可惜。'),
  mixedTextBlock([
    { text: '現在主流是「動物友善」的大象保護營，不騎乘、沒有表演，而是讓你幫大象準備午餐、餵食、一起洗澡。' },
    { text: '親手幫大象洗澡、準備午餐——這種近距離接觸，絕對是畢生難忘的體驗。', bold: true, highlight: true },
  ]),
  textBlock('我們合作的營區都是友善營，會根據你家小孩的年齡，建議最適合的體驗方式。'),
  textBlock('📍 位置： 湄登區'),
  textBlock('⏰ 建議停留： 半天'),
  textBlock('💬 想了解更多？ 私訊告訴我們小孩年齡，幫你推薦適合的方案'),
  textBlock('📷 [照片：大象體驗 1-2 張]'),

  // 3. 大象粑粑紙公園
  textBlock('3. 大象粑粑紙公園（Elephant Poopoopaper Park）', 'h3'),
  textBlock('聽起來很搞笑，但這是我們很推的親子景點。'),
  boldTextBlock('整個園區講解大象便便怎麼變成再生紙，小孩可以親手「洗便便」（放心，真的不臭），然後做成書籤帶回家。教育意義滿分，而且體驗感很強。'),
  textBlock('全程戶外但有樹蔭，大概 1.5 小時可以玩完。'),
  textBlock('📍 位置： 湄林區'),
  textBlock('📍 門票： 150฿，4歲以下免費（DIY 另計約 50-100฿）'),
  textBlock('⏰ 建議停留： 1.5-2 小時'),

  // 4. Tiger Kingdom
  textBlock('4. 清邁老虎王國（Tiger Kingdom）', 'h3'),
  textBlock('想跟老虎近距離接觸？這裡可以。'),
  boldTextBlock('園內有不同體型的老虎，從幼虎到巨虎都有。進籠子裡互動約 10 分鐘，可以摸老虎尾巴、肚子，專業馴獸員全程陪同。拍出來的照片超震撼。'),
  textBlock('注意： 最小的老虎（Smallest）需要身高 110cm 以上才能進，大老虎要 16 歲或 160cm 以上。帶小小孩的話，只能看最小體型的。'),
  textBlock('📍 位置： 湄林區'),
  textBlock('📍 門票： 單一體型 450-900฿，套票 850-3,900฿'),
  textBlock('⏰ 建議停留： 1-1.5 小時'),
  textBlock('📷 [影片：老虎王國]'),

  // 5. Uncle Pong
  textBlock('5. Uncle Pong 豬豬農場 🌟 私房推薦', 'h3'),
  textBlock('這間是導遊私下推薦的，我們帶女兒去完驚為天人。'),
  mixedTextBlock([
    { text: '有孔雀、鴨子、山羊表演，但' },
    { text: '重頭戲是一群豬從溜滑梯滑下來！後面的豬看前面太慢，還會把牠往前推下水，超好笑 😂', bold: true, highlight: true },
  ]),
  textBlock('不是觀光客會去的大景點，但真的很值得。表演時間固定，記得算好時間。'),
  textBlock('📍 位置： 湄登區'),
  textBlock('📍 門票： 成人 200฿，兒童 120฿'),
  textBlock('⏰ 表演時間： 10:30 / 11:30 / 13:30 / 14:30 / 15:30'),
  textBlock('⏰ 建議停留： 1.5 小時'),
  textBlock('📷 [影片：豬豬溜滑梯]'),

  // ▋戶外放電類
  textBlock('戶外放電類', 'h2'),
  textBlock('小孩電力太強？這三個地方保證放到沒電。'),

  // 6. Grand Canyon
  textBlock('6. 大峽谷水上樂園（Grand Canyon Water Park）', 'h3'),
  textBlock('清邁最受歡迎的水上樂園，導遊大力推薦。'),
  mixedTextBlock([
    { text: '有巨型充氣城堡、滑水道、獨木舟、滑索，救生衣都含在門票裡。' },
    { text: '專門的兒童區安全性高', bold: true, highlight: true },
    { text: '，爸媽可以放心讓小孩玩。' },
  ]),
  boldTextBlock('注意： 要認明是「Water Park」（有充氣設施的），不是隔壁只有風景的 Grand Canyon（那個門票只要 100฿，但沒得玩）。'),
  textBlock('📍 門票： 成人 950฿，兒童（90-120cm）750฿，90cm以下免費'),
  textBlock('⏰ 建議停留： 3-4 小時（可以玩整個早上）'),
  textBlock('📷 [影片：水上樂園]'),

  // 7. Phoenix Adventure
  textBlock('7. 鳳凰冒險樂園（Phoenix Adventure Park）', 'h3'),
  textBlock('這不是一般的滑索，是「高空繩索障礙場」。'),
  mixedTextBlock([
    { text: '走鋼索、爬網子、過獨木橋、空中騎腳踏車... 全程在樹冠層闖關。' },
    { text: '非常耗體力，玩完晚上保證秒睡。', bold: true, highlight: true },
  ]),
  textBlock('分三種難度：'),
  textBlock('• S 方案（20 關卡）：900฿，適合 4-5 歲以上'),
  textBlock('• M 方案（25 關卡）：1,200฿'),
  textBlock('• L 方案（45 關卡）：1,700฿'),
  tipBox('warning', '穿著提醒：長褲、運動鞋（不能穿拖鞋），記得帶防蚊液。叢林裡蚊子很多，沒噴的話會被叮成紅豆冰。'),
  textBlock('📍 位置： 湄林區'),
  textBlock('⏰ 營業： 08:30-17:30'),
  textBlock('⏰ 建議停留： 2-3 小時'),
  textBlock('📷 [照片：Phoenix Adventure 傳單/園區圖]'),

  // 8. Royal Park
  textBlock('8. 皇家花園（Royal Park Rajapruek）', 'h3'),
  textBlock('超大的皇家花園，適合帶小孩散步放風。'),
  boldTextBlock('園區很大，強烈建議搭電動遊園車，隨停隨下很方便。有泰式皇家建築、蝴蝶館、還有兒童遊樂區（Bug World）。'),
  textBlock('步調很悠閒，我上次去的時候女兒在遊園車上直接睡著。'),
  textBlock('📍 門票： 成人 200฿，兒童（100-140cm）150฿，100cm以下免費，遊園車 20฿'),
  textBlock('⏰ 建議停留： 1.5-2 小時'),
  textBlock('📷 [影片：Royal Park]'),

  // ▋室內雨備
  textBlock('室內雨備', 'h2'),
  textBlock('清邁午後偶爾有雷陣雨（雨季 5-10 月更頻繁），這兩個室內景點是最佳備案。'),

  // 9. Bouncetopia
  textBlock('9. Bouncetopia 充氣樂園', 'h3'),
  textBlock('新加坡來的巨型充氣城堡，就在 Central Festival 商場 3 樓。'),
  mixedTextBlock([
    { text: '2000 平方公尺的充氣溜滑梯、波波池、障礙賽，' },
    { text: '冷氣超強，小孩放電、爸媽吹冷氣喝咖啡。', bold: true, highlight: true },
  ]),
  textBlock('需要穿防滑襪（現場可買 50฿），適合 2-10 歲。'),
  textBlock('📍 位置： Central Festival 3F'),
  textBlock('📍 門票： 成人 150฿，兒童 250฿'),
  textBlock('⏰ 建議停留： 2 小時'),
  textBlock('📷 [照片：Bouncetopia 充氣城堡]'),

  // 10. Art in Paradise
  textBlock('10. Art in Paradise 3D 美術館', 'h3'),
  textBlock('互動式 3D 美術館，整間都是錯視藝術。'),
  boldTextBlock('小孩可以假裝被恐龍追、在瀑布前衝浪、走在懸崖邊... 需要爸媽「戲精上身」一起演，拍出來的照片才好笑。'),
  textBlock('有專屬 App，對著牆壁拍照，畫裡的動物會動起來，小孩超愛。'),
  boldTextBlock('注意： 需要脫鞋入場，建議穿有止滑的襪子。'),
  textBlock('📍 門票： 成人 460฿，兒童（100-140cm）240฿，100cm以下免費'),
  textBlock('⏰ 建議停留： 2 小時以上'),
  textBlock('📷 [照片：Art in Paradise x2-3 張]'),

  // ▋進階選項
  textBlock('進階選項：黏黏瀑布', 'h2'),
  textBlock('如果小孩年紀大一點（建議 7 歲以上），可以考慮這個神奇景點。'),
  textBlock('黏黏瀑布（Bua Tong Sticky Waterfalls）是石灰岩瀑布，石面有天然摩擦力，可以逆流而上攀爬。'),
  boldTextBlock('但地面濕滑，太小的孩子不建議。記得帶換洗衣物和防滑鞋。'),
  textBlock('📍 位置： 湄登區'),
  textBlock('📍 門票： 免費'),

  // ▋行程怎麼排
  textBlock('行程怎麼排最順？', 'h2'),
  textBlock('這些景點分散在不同區域，排行程要注意順路：'),
  boldTextBlock('湄林區一日遊（北邊）'),
  textBlock('Tiger Kingdom → 大象粑粑紙公園 → Phoenix Adventure'),
  boldTextBlock('湄登區一日遊'),
  textBlock('大象保護營（半天）→ Uncle Pong 豬豬農場'),
  boldTextBlock('市區悠閒日'),
  textBlock('早上：Grand Canyon 水上樂園'),
  textBlock('下午：Art in Paradise → Central（Bouncetopia + 逛街）'),
  boldTextBlock('獨立安排'),
  textBlock('夜間動物園（傍晚入園，玩到晚上）'),
  mixedTextBlock([
    { text: '💡 小提醒： 清邁景點分散，' },
    { text: '包車是最適合親子的交通方式', link: '/blog/chiang-mai-transportation' },
    { text: '。帶小孩搭雙條車很折騰，Grab 叫車在郊區也不太方便。' },
  ]),

  // ▋常見問題 FAQ
  textBlock('常見問題 FAQ', 'h2'),

  questionBlock('Q1: 清邁親子景點一天可以跑幾個？'),
  textBlock('A: 建議 2-3 個就好。帶小孩不要排太趕，每個景點都玩得盡興比較重要。趕行程小孩累、大人也累。'),

  questionBlock('Q2: 哪些景點有冷氣？'),
  textBlock('A: Bouncetopia 和 Art in Paradise。這兩個是下雨天或中午太熱時的最佳選擇。'),

  questionBlock('Q3: 推嬰兒車方便嗎？'),
  textBlock('A: 大部分景點都算推車友善，但建議帶可摺疊、好收納的款式。上下車方便，景點內有些路段可能要收起來扛。'),

  questionBlock('Q4: 哪些景點適合 2 歲以下嬰幼兒？'),
  textBlock('A: 夜間動物園（坐車看動物）、Royal Park（搭遊園車）、Bouncetopia（有幼兒區）。太刺激的像 Phoenix Adventure、Tiger Kingdom 要等大一點。'),

  questionBlock('Q5: 門票可以現場買嗎？還是要先預訂？'),
  textBlock('A: 大部分現場買就好。夜間動物園和大象體驗建議提前預訂，尤其旺季（11-2月）人很多。'),

  questionBlock('Q6: 清邁包車一天多少錢？'),
  textBlock('A: 依車型和行程而定。想了解的話，私訊告訴我們人數和想去的景點，幫你報價。'),

  questionBlock('Q7: 有沒有不推薦帶小孩去的景點？'),
  textBlock('A: 拜縣（762 個彎道，小孩會暈到吐）、清萊白廟黑廟一日遊（來回 8 小時車程，小孩會崩潰）、週日夜市晚上 7 點後（人多到推車推不動）。'),

  questionBlock('Q8: 夜間動物園白天可以去嗎？'),
  textBlock('A: 可以，但沒意義。白天動物都在睡覺，精彩的遊園車和餵食體驗都是傍晚後才開始。建議 5 點入園最剛好。'),

  // ▋結語
  textBlock('結語', 'h2'),
  textBlock('清邁的親子景點真的很多，但不是每個都適合帶小孩。'),
  textBlock('這 10 個是我們住在這裡、實際帶女兒和客人去過的口袋名單。有問題歡迎私訊討論，我們可以根據你家小孩的年齡和喜好，幫你安排最適合的行程。'),
]

const post = {
  _type: 'post',
  title: '清邁親子景點 TOP 10｜在地爸媽真心推薦，帶小孩這樣玩最放電',
  slug: { _type: 'slug', current: 'chiang-mai-family-attractions-top10' },
  excerpt:
    '住在清邁的台灣爸爸整理 10 個真正適合帶小孩的景點：夜間動物園、大象體驗、豬豬農場、水上樂園、3D 美術館... 按動物互動、戶外放電、室內雨備分類，附門票價格與行程建議。',
  body,
  seoTitle: '清邁親子景點推薦2026｜10大必去景點門票價格完整攻略',
  seoDescription:
    '清邁親子景點怎麼選？在地爸媽推薦 10 大必去：夜間動物園、大象體驗、豬豬農場、水上樂園、3D 美術館。附門票價格、建議停留時間、行程路線安排。',
  seoKeywords: [
    '清邁親子景點',
    '清邁親子自由行',
    '清邁景點推薦',
    '清邁夜間動物園',
    '清邁大象',
    '清邁水上樂園',
    '清邁親子行程',
    '清邁帶小孩',
    'Chiang Mai family attractions',
    '清邁必去景點',
  ],
  category: 'attraction',
  featured: true,
  publishedAt: new Date().toISOString(),
}

async function createPost() {
  console.log('正在建立文章...')
  console.log('Project ID:', process.env.NEXT_PUBLIC_SANITY_PROJECT_ID)
  console.log('Dataset:', process.env.NEXT_PUBLIC_SANITY_DATASET)
  console.log('Token:', process.env.SANITY_API_TOKEN ? '已設定' : '未設定')

  if (!process.env.SANITY_API_TOKEN) {
    console.error('❌ 缺少 SANITY_API_TOKEN，請在 .env.local 設定')
    process.exit(1)
  }

  try {
    const result = await client.create(post)
    console.log('')
    console.log('✅ 文章建立成功！')
    console.log('文章 ID:', result._id)
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('⚠️  還需要手動完成以下步驟：')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log('1. 📷 上傳封面圖片')
    console.log('   ALT: 清邁親子景點推薦TOP10')
    console.log('')
    console.log('2. 🎬 在「夜間動物園」段落插入影片')
    console.log('   ALT: 清邁夜間動物園餵長頸鹿體驗')
    console.log('')
    console.log('3. 📷 在「大象體驗」段落插入照片 1-2 張')
    console.log('   ALT: 清邁大象友善體驗親子互動')
    console.log('')
    console.log('4. 🎬 在「老虎王國」段落插入影片')
    console.log('   ALT: 清邁老虎王國近距離接觸老虎')
    console.log('')
    console.log('5. 🎬 在「豬豬農場」段落插入影片')
    console.log('   ALT: 清邁豬豬農場溜滑梯表演')
    console.log('')
    console.log('6. 🎬 在「水上樂園」段落插入影片')
    console.log('   ALT: 清邁大峽谷水上樂園親子玩水')
    console.log('')
    console.log('7. 📷 在「Phoenix Adventure」段落插入照片')
    console.log('   ALT: 清邁鳳凰冒險樂園高空繩索')
    console.log('')
    console.log('8. 🎬 在「Royal Park」段落插入影片')
    console.log('   ALT: 清邁皇家花園遊園車親子遊')
    console.log('')
    console.log('9. 📷 在「Bouncetopia」段落插入照片')
    console.log('   ALT: 清邁Bouncetopia室內充氣樂園')
    console.log('')
    console.log('10. 📷 在「Art in Paradise」段落插入照片 2-3 張')
    console.log('    ALT: 清邁3D美術館親子互動拍照')
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📝 請到 Sanity Studio 完成編輯：')
    console.log('https://chiangway-travel.com/studio')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } catch (error) {
    console.error('❌ 建立失敗:', error.message)
    if (error.statusCode === 403) {
      console.error('   Token 權限不足，請確認 SANITY_API_TOKEN 有寫入權限')
    }
  }
}

createPost()
