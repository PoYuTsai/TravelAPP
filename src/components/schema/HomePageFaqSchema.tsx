const homePageFaqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: '清微旅行的清邁包車是一般司機接送，還是有旅遊規劃服務？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '清微旅行不是只有單純接送，而是以在地家庭視角提供清邁包車、行程安排與旅遊建議，協助親子家庭與自由行旅客更安心地玩清邁。',
      },
    },
    {
      '@type': 'Question',
      name: '如果是第一次到清邁自由行，適合直接找清微旅行安排行程嗎？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '可以。清微旅行擅長依照旅客停留天數、同行成員與想去的區域，協助安排包車動線與景點節奏，特別適合第一次來清邁、想省去自己查資料時間的家庭旅客。',
      },
    },
    {
      '@type': 'Question',
      name: '清邁包車價格大概怎麼算？會不會到現場才另外加價？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '一般包車價格會依車型、服務時數、行程區域與是否跨區而調整。清微旅行會先在出發前說明價格與服務內容，避免旅途中才追加費用。',
      },
    },
    {
      '@type': 'Question',
      name: '清微旅行適合帶小孩的親子家庭嗎？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '是。清微旅行本身就是住在清邁的台灣爸爸與泰國媽媽家庭，熟悉親子旅遊需求，也能協助安排適合孩子年齡、作息與節奏的清邁行程。',
      },
    },
    {
      '@type': 'Question',
      name: '除了熱門景點，你們也會推薦比較在地、比較不擁擠的清邁玩法嗎？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '會。除了經典景點，清微旅行也會依旅客偏好推薦較在地、較適合親子或適合放慢步調的玩法，讓旅程不只是走馬看花。',
      },
    },
    {
      '@type': 'Question',
      name: '清微旅行只有清邁市區包車，還是也能安排清萊、多天行程？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '除了清邁市區，也可以安排清萊一日遊、多天包車、親子慢遊與客製化旅遊行程，會依實際需求協助規劃。',
      },
    },
    {
      '@type': 'Question',
      name: '如果我還沒決定完整行程，也可以先問你們建議嗎？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '可以。很多旅客都是先透過 LINE 詢問天數、住宿區域或想去的地方，再由清微旅行協助整理適合的方向與安排建議。',
      },
    },
    {
      '@type': 'Question',
      name: '聯絡清微旅行規劃包車或自由行，最方便的方式是什麼？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '最方便的方式是直接加入 LINE 與我們聯繫。你可以先提供旅遊日期、人數、是否有孩子，以及想去的地區，我們會再協助你安排。',
      },
    },
  ],
}

export default function HomePageFaqSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(homePageFaqSchema) }}
    />
  )
}
