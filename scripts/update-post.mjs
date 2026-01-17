import { createClient } from '@sanity/client'

const client = createClient({
  projectId: 'xefjjue7',
  dataset: 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})

const documentId = 'BU6a4jQyI1BbfpIHWqt5Z7'

// Helper to create a unique key for Portable Text blocks
const generateKey = () => Math.random().toString(36).substring(2, 12)

// Convert text to Portable Text block
function textToBlock(text, style = 'normal') {
  if (!text.trim()) return null

  const children = []
  const parts = text.split(/(\*\*[^*]+\*\*)/)

  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      children.push({
        _type: 'span',
        _key: generateKey(),
        text: part.slice(2, -2),
        marks: ['strong'],
      })
    } else if (part) {
      children.push({
        _type: 'span',
        _key: generateKey(),
        text: part,
        marks: [],
      })
    }
  }

  if (children.length === 0) return null

  return {
    _type: 'block',
    _key: generateKey(),
    style,
    markDefs: [],
    children,
  }
}

// Convert markdown content to Portable Text
function markdownToPortableText(markdown) {
  const blocks = []
  const lines = markdown.split('\n')

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()

    if (!line) {
      i++
      continue
    }

    if (line.startsWith('# ')) {
      i++
      continue
    }

    if (line === '－' || line === '---') {
      i++
      continue
    }

    if (line.startsWith('▋')) {
      const heading = line.replace('▋', '').trim()
      blocks.push(textToBlock(heading, 'h2'))
      i++
      continue
    }

    if (line.match(/^\*\*Q\d+:/)) {
      blocks.push(textToBlock(line, 'h3'))
      i++
      continue
    }

    if (line.startsWith('A:')) {
      blocks.push(textToBlock(line, 'normal'))
      i++
      continue
    }

    if (line.includes('LINE 免費諮詢') || line.includes('👉')) {
      blocks.push({
        _type: 'ctaBlock',
        _key: generateKey(),
        title: '想來清邁親子旅遊？',
        description: '清微旅行提供專業司機 + 中文導遊，行程彈性、不踩雷。',
      })
      i++
      continue
    }

    if (line === '📍' || line.startsWith('📍 **')) {
      i++
      continue
    }

    const block = textToBlock(line, 'normal')
    if (block) {
      blocks.push(block)
    }
    i++
  }

  return blocks.filter(Boolean)
}

// Updated article content with fixes:
// 1. 25,000 -> 25,000 泰銖
// 2. Added transition sentence before CTA
const updatedContent = `
我的韓國朋友，在清邁酒吧放歌時被移民局當場逮捕，關了 13 天。

這不是新聞標題，是我親眼看著發生的事。

－

▋認識這位韓國 DJ

我們在清邁大學的一年制泰文班認識。

他是 DJ，泰文講得比我好上好幾個檔次，高高帥帥又很會聊天。那種社交能力，我只能用「頂級」來形容——在酒吧裡跟泰國人把酒言歡、深入交流，完全沒有語言隔閡。

靠著這種能力，他很快融入清邁當地的 DJ 圈。認識酒吧老闆、拉近關係、互相轉介，2025 年他幾乎每週都有 bar 可以放歌。

看起來一切都很順利。

－

▋2024 年 12 月：臉書滑到他被捕的照片

好景不常，12 月一切變了調。

那時我帶老婆和女兒回台灣，大概是 12 月 10 號左右。老婆滑臉書時突然叫我過去看——清邁新聞的官方粉專，有一張逮捕照片。

臉打了馬賽克，但那個身高、那個特徵，我一看就知道是他。

我們都嚇到了。

－

▋IG 傳訊息，他說已經在監獄裡好幾天了

我馬上傳訊息關心。

他回覆的內容讓我印象很深：「已經在清邁的監獄裡被關好幾天了。」

我問他需要什麼幫忙，他說：「能不能送一些食物過去？」

天啊。我當下只有一個念頭——太慘了。

－

▋清邁監獄關了 13 天

後來我們 2026/1/15 在清邁碰面，他才跟我們完整講了這段經歷。

他說，其實不用關那麼久。

會拖到 13 天，是因為泰國當局要等「同樣狀況的人」一起處理——就是那些沒有工作簽、卻在泰國做生意或打工被抓的人。湊齊了，才會一批遣返。

我自己的猜測是，一定有人眼紅去檢舉他。畢竟一堆緬甸人也在非法打工，怎麼都沒事？但他一個韓國人，高調在各大酒吧放歌，太容易成為目標。

－

▋轉移到曼谷：原本要坐 9 小時的車

關完 13 天，下一步是轉移到曼谷移民局辦遣返手續。

這個過程有多沒效率？原本的安排是：從清邁「坐車」到曼谷。

不知道大家有沒有概念，這單趟最少要 9 小時。來回就是兩天起跳，而且最後還要從曼谷遣返回韓國，不是回清邁。

好在他身邊真的有很多泰國朋友幫忙，最後才得以改搭飛機。

代價是：要自己付一位警察的來回機票錢。

但他沒得選，這已經是最好的選項了。

－

▋曼谷監獄：只待了一天，但他說那裡才可怕

到了曼谷，又是另一位當地泰國朋友出手幫忙。

最後他只被關了一天。

他說，好險只有一天。因為曼谷那邊關的都是重刑犯，環境跟清邁完全不能比，「根本不是人待的地方」。

如果沒有認識的人，他真的不知道該怎麼撐過去。

－

▋12/28：想回清邁跨年，卻被原地遣返

遣返回韓國之後，他還是很想回來清邁跟朋友跨年。

12 月 28 號，他飛回來了。

結果在海關被攔下來：「你不能用免簽入境，要申請 TR 觀光簽。」

問題是，韓國跟台灣一樣本來就是免簽國，TR 觀光簽已經很久沒有旅行社在辦了。他這種「曾經被遣返」的特殊案例，根本不知道找誰處理。

當天，他被原地遣返回韓國。

是我的話，大概早就放棄了。但他是真的很愛清邁。

－

▋回韓國找 agent，有人說不行，有人開價

回到韓國之後，他開始找各種 agent 處理這個案子。

有些 agent 直接說：「這種 case 我們不接。」

有些說可以，但要收費。

那段時間我幫他擬了一封信，是要寄給泰國移民局詢問的——確認他這種情況能不能申請 TR 簽、還是要走其他管道。

他後來跟我說：「你寫的那封信真的幫了大忙。」

－

▋花了 25,000 泰銖，終於在 12/31 回到清邁

最後他付了 25,000 泰銖給 agent 處理，這還不包含機票。

沒得選。這是唯一能讓他合法入境的方式。

12 月 31 號，他終於成功回到清邁，趕上跨年。

－

▋這件事教會我的三件事

**第一，合法簽證是底線。**

沒有工作簽，就是不能在泰國工作賺錢。不管你泰文多好、人脈多廣、融入得多深，被抓到就是拘留、遣返、上黑名單。

**第二，在泰國，關係太重要了。**

他能少受很多苦，全靠那些泰國朋友幫忙——改搭飛機、曼谷監獄只待一天、找到願意接案的 agent。沒有這些人，後果不敢想像。

**第三，能花錢解決的事情都是小事。**

25,000 泰銖不便宜，但至少問題解決了。真正可怕的是：沒錢、沒人脈、沒有人幫你。

－

▋補充：ED 教育簽證也在收緊

順帶一提，我們當初在清邁大學念泰文用的 ED 教育簽，現在也越來越難搞了。

2025 年泰國政府開始嚴查，課程上限從一年縮短到 180 天，出席率要達到 80% 以上，光是去年就有將近一萬張學生簽被撤銷。原因都一樣：有人拿學生簽當掩護，實際在打黑工。

想靠 ED 簽長居的人，要有心理準備。

－

▋常見問題 FAQ

**Q1: 用觀光免簽可以在泰國打工嗎？**

A: 絕對不行。不管是免簽還是觀光簽，都明確禁止工作。被抓到的後果就是我朋友的遭遇：拘留、遣返、黑名單，下次入境難上加難。

**Q2: 我只是想來清邁旅遊，需要擔心嗎？**

A: 完全不用。這篇是寫給想「長期居留」的人看的。如果你只是來玩，遵守免簽 60 天的規定、填好 TDAC 數位入境卡、帶夠旅費，開開心心來玩就好。

－

▋結語

這篇文章沒有要嚇誰，只是想把朋友的真實經歷記錄下來。

在泰國，有關係就沒關係。但在那之前，你得先守法。

想長居清邁或泰國，不管是婚姻簽、工作簽、精英簽還是 DTV，先搞定合法身份，其他的才有意義。

如果你是來清邁旅遊的家庭，不用擔心這些，專心玩就好。需要包車服務，歡迎找我們聊聊。
`

async function updatePost() {
  console.log('Converting updated content to Portable Text...')
  const body = markdownToPortableText(updatedContent)

  console.log('Updating post in Sanity...')

  try {
    const result = await client
      .patch(documentId)
      .set({ body })
      .commit()

    console.log('Post updated successfully!')
    console.log('Document ID:', result._id)
  } catch (error) {
    console.error('Error updating post:', error.message)
    process.exit(1)
  }
}

updatePost()
