import { createClient } from '@sanity/client'

const client = createClient({
  projectId: 'xefjjue7',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
})

const post = {
  _type: 'post',
  title: '清邁交通攻略：Grab、雙條車、包車怎麼選？在地台灣人的真心話',
  slug: { current: 'chiang-mai-transportation' },
  excerpt: '清邁沒有捷運、沒有BTS，觀光客該怎麼移動？這篇整理了Grab、雙條車、嘟嘟車、包車的優缺點、真實價格，還有在地人才知道的避雷指南。',
  category: 'transportation',
  featured: false,
  publishedAt: new Date().toISOString(),
  body: [
    {
      _type: 'block',
      _key: 'intro1',
      style: 'normal',
      children: [{ _type: 'span', _key: 'intro1a', text: '清邁沒有捷運，沒有 BTS，沒有地鐵。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'intro2',
      style: 'normal',
      children: [{ _type: 'span', _key: 'intro2a', text: '對，你沒看錯。泰國第二大城，什麼軌道交通都沒有。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'intro3',
      style: 'normal',
      children: [{ _type: 'span', _key: 'intro3a', text: '第一次來的人通常會愣住：「蛤？那我要怎麼移動？」' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'intro4',
      style: 'normal',
      children: [{ _type: 'span', _key: 'intro4a', text: '我住在清邁兩年多，可以很直接告訴你：每個清邁人家裡都有車，不然根本出不了門。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'intro5',
      style: 'normal',
      children: [{ _type: 'span', _key: 'intro5a', text: '那觀光客該怎麼辦？' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'intro6',
      style: 'normal',
      children: [{ _type: 'span', _key: 'intro6a', text: '這篇文章整理了清邁所有交通方式的優缺點、真實價格、還有我看過的踩雷案例。不管你是自己來、帶小孩、還是帶長輩，看完就知道怎麼選。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'h2_1',
      style: 'h2',
      children: [{ _type: 'span', _key: 'h2_1a', text: '清邁交通方式總覽' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'overview1',
      style: 'normal',
      children: [{ _type: 'span', _key: 'overview1a', text: '先給你一張表，快速掌握各種交通方式：' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'overview2',
      style: 'normal',
      children: [{ _type: 'span', _key: 'overview2a', text: '• Grab / Bolt：市區移動、古城到尼曼，機場到市區約 150-200 泰銖' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'overview3',
      style: 'normal',
      children: [{ _type: 'span', _key: 'overview3a', text: '• 雙條車：短程、預算有限，20-50 泰銖/人' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'overview4',
      style: 'normal',
      children: [{ _type: 'span', _key: 'overview4a', text: '• 嘟嘟車：不推薦，容易被喊價' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'overview5',
      style: 'normal',
      children: [{ _type: 'span', _key: 'overview5a', text: '• 包車：近郊、長途、親子家庭，一日約 2,500-4,000 泰銖' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'overview6',
      style: 'normal',
      children: [{ _type: 'span', _key: 'overview6a', text: '• 租機車：自由探索、年輕背包客，約 200-300 泰銖/天' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'overview7',
      style: 'normal',
      children: [{ _type: 'span', _key: 'overview7a', text: '• Maxim：當地人用、便宜，比 Grab 便宜但介面是泰文' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'h2_2',
      style: 'h2',
      children: [{ _type: 'span', _key: 'h2_2a', text: 'Grab / Bolt：觀光客最穩的選擇' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'grab1',
      style: 'normal',
      children: [{ _type: 'span', _key: 'grab1a', text: '如果你只在清邁市區活動，Grab 或 Bolt 就夠了。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'grab2',
      style: 'normal',
      children: [{ _type: 'span', _key: 'grab2a', text: '輸入起點、輸入終點，價格直接顯示在螢幕上。不用殺價、不用比手畫腳、不用怕被坑。這是觀光客最安心的選擇。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'grab3',
      style: 'normal',
      children: [{ _type: 'span', _key: 'grab3a', text: '機場到古城大約 150-200 泰銖，視距離和時段而定。Bolt 的價格通常比 Grab 再便宜一點點，兩個 App 都裝著比價就對了。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'grab4',
      style: 'normal',
      children: [
        { _type: 'span', _key: 'grab4a', text: '但有一個大雷要避：', marks: ['strong'] },
        { _type: 'span', _key: 'grab4b', text: '不要用 Grab 去太偏遠的地方。' }
      ],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'grab5',
      style: 'normal',
      children: [{ _type: 'span', _key: 'grab5a', text: '我看過有人叫 Grab 去湄林區（Mae Rim），或是上蒙占山看雲海。上山的時候很順利，風景很美，拍了一堆照片。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'grab6',
      style: 'normal',
      children: [{ _type: 'span', _key: 'grab6a', text: '然後準備下山的時候，打開 Grab，附近沒有車。等 10 分鐘，沒有車。等 30 分鐘，還是沒有車。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'grab7',
      style: 'normal',
      children: [{ _type: 'span', _key: 'grab7a', text: '那種前不著村後不著店、手機快沒電、太陽又很大的感覺，真的會讓人開始懷疑人生。如果要去近郊或山區，建議包車或確保有回程的交通安排。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'h2_3',
      style: 'h2',
      children: [{ _type: 'span', _key: 'h2_3a', text: '雙條車：便宜但要有心理準備' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'song1',
      style: 'normal',
      children: [{ _type: 'span', _key: 'song1a', text: '雙條車是清邁的特色交通工具。紅色車身、後面有兩排座位面對面，一排坐 4 個人，總共可以坐 8 個人。沒有冷氣，但有遮棚。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'song2',
      style: 'normal',
      children: [{ _type: 'span', _key: 'song2a', text: '價格便宜，市區內大概 20-50 泰銖就能搞定。適合預算有限、行程不趕、想體驗在地感的旅人。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'song3',
      style: 'normal',
      children: [{ _type: 'span', _key: 'song3a', text: '但我要老實說：雙條車沒有固定路線，要跟司機溝通目的地。如果你泰文不好、英文也普通，溝通成本會比較高。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'song4',
      style: 'normal',
      children: [{ _type: 'span', _key: 'song4a', text: '而且我真的親眼看過一台雙條車坐滿 8 個人之後，居然還有 2 個人站在車外，單手拉著扶手，另一手拿著飲料，一臉淡定。我當時心想：這也太猛了吧？' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'song5',
      style: 'normal',
      children: [{ _type: 'span', _key: 'song5a', text: '那個畫面讓我印象深刻，也讓我決定——帶小孩絕對不搭雙條車。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'h2_4',
      style: 'h2',
      children: [{ _type: 'span', _key: 'h2_4a', text: '嘟嘟車：觀光客陷阱，能避則避' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'tuk1',
      style: 'normal',
      children: [{ _type: 'span', _key: 'tuk1a', text: '古城周邊很常看到嘟嘟車在路邊等客人。看起來很有泰國風情，但我必須說：這是觀光客最容易被坑的交通方式。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'tuk2',
      style: 'normal',
      children: [{ _type: 'span', _key: 'tuk2a', text: '司機一看你是觀光客，眼睛發亮，價格直接翻倍喊。你還沒開口，他已經在心裡幫你結帳了。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'tuk3',
      style: 'normal',
      children: [{ _type: 'span', _key: 'tuk3a', text: '更慘的是，有些司機跟你談好價格上車了，到了目的地突然失憶，跟你收的錢跟一開始講的不一樣。你人生地不熟，語言又不通，旁邊也沒有路人可以幫你講話。最後只能摸摸鼻子付錢，心裡默默把這台車列入黑名單。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'tuk4',
      style: 'normal',
      children: [{ _type: 'span', _key: 'tuk4a', text: '我的建議：能避則避。真的想體驗，就當作觀光行程，先講好價格、拍照存證，心理也要有被加價的準備。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'h2_5',
      style: 'h2',
      children: [{ _type: 'span', _key: 'h2_5a', text: 'Maxim：當地人的秘密武器' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'max1',
      style: 'normal',
      children: [{ _type: 'span', _key: 'max1a', text: '這個 App 大部分觀光客不知道，但清邁當地人都在用。Maxim 的價格比 Grab 和 Bolt 都便宜，有時候便宜不少。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'max2',
      style: 'normal',
      children: [{ _type: 'span', _key: 'max2a', text: '但問題來了：Maxim 的介面主要是泰文，定位系統也不太支援 Google 地圖上的英文店家名稱。如果你不會泰文，光是輸入目的地就會卡關。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'max3',
      style: 'normal',
      children: [{ _type: 'span', _key: 'max3a', text: '我自己的經驗是 2024 年潑水節那天，整個清邁大塞車，Grab 上不管是汽車還是摩托車都叫不到。當時有位好心的當地人幫我用 Maxim，居然秒叫到摩托車。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'max4',
      style: 'normal',
      children: [{ _type: 'span', _key: 'max4a', text: '所以如果你有泰國朋友同行，或是會一點泰文，Maxim 是個省錢的好選擇。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'h2_6',
      style: 'h2',
      children: [{ _type: 'span', _key: 'h2_6a', text: '租機車自駕：自由但要評估風險' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'motor1',
      style: 'normal',
      children: [{ _type: 'span', _key: 'motor1a', text: '想要最大的自由度？租機車是一個選項。古城附近有幾間不錯的租車店，價錢大約 200-300 泰銖一天，不算貴。有些老闆還會說中文，溝通沒問題。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'motor2',
      style: 'normal',
      children: [{ _type: 'span', _key: 'motor2a', text: '騎車逛古城、跑尼曼、去夜市，確實很方便。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'motor3',
      style: 'normal',
      children: [{ _type: 'span', _key: 'motor3a', text: '但我要提醒：泰國是右駕，跟台灣相反。交通規則不太一樣，路上的車也不一定會禮讓你。如果你帶小孩、帶長輩，或是對騎車沒把握，我不建議租機車。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'motor4',
      style: 'normal',
      children: [{ _type: 'span', _key: 'motor4a', text: '機車上沒辦法裝安全座椅，萬一出事，後果不堪設想。這個選項比較適合年輕人、背包客、或是本身就很會騎車的人。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'h2_7',
      style: 'h2',
      children: [{ _type: 'span', _key: 'h2_7a', text: '什麼時候該包車？' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'charter1',
      style: 'normal',
      children: [
        { _type: 'span', _key: 'charter1a', text: '建議包車的情境：', marks: ['strong'] }
      ],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'charter2',
      style: 'normal',
      children: [{ _type: 'span', _key: 'charter2a', text: '• 帶小孩：需要安全座椅、推車收納空間、冷氣、彈性的行程節奏' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'charter3',
      style: 'normal',
      children: [{ _type: 'span', _key: 'charter3a', text: '• 帶長輩：舒適度優先，不想讓爸媽在大太陽下等車' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'charter4',
      style: 'normal',
      children: [{ _type: 'span', _key: 'charter4a', text: '• 去近郊：大象營、叢林飛索、湄林區' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'charter5',
      style: 'normal',
      children: [{ _type: 'span', _key: 'charter5a', text: '• 去遠郊：清萊白廟藍廟，單趟車程 3 小時' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'charter6',
      style: 'normal',
      children: [{ _type: 'span', _key: 'charter6a', text: '這些情境用 Grab 會很痛苦，用雙條車更不可能。包車雖然貴一點，但省下來的時間、體力、還有旅途中的舒適度，絕對值得。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'charter7',
      style: 'normal',
      children: [
        { _type: 'span', _key: 'charter7a', text: '不需要包車的情境：', marks: ['strong'] }
      ],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'charter8',
      style: 'normal',
      children: [{ _type: 'span', _key: 'charter8a', text: '• 只在古城 + 尼曼區活動' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'charter9',
      style: 'normal',
      children: [{ _type: 'span', _key: 'charter9a', text: '• 預算有限' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'charter10',
      style: 'normal',
      children: [{ _type: 'span', _key: 'charter10a', text: '• 行程很彈性，想隨走隨停' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'charter11',
      style: 'normal',
      children: [{ _type: 'span', _key: 'charter11a', text: '這種情況用 Grab 或 Bolt 就很夠用了。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'h2_8',
      style: 'h2',
      children: [{ _type: 'span', _key: 'h2_8a', text: '山區景點要換車：安全比什麼都重要' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'mtn1',
      style: 'normal',
      children: [{ _type: 'span', _key: 'mtn1a', text: '有些清邁的山區景點，不是你包車就能直接開上去的。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'mtn2',
      style: 'normal',
      children: [{ _type: 'span', _key: 'mtn2a', text: '像是知名的巨樹咖啡廳（Giant Tree Cafe）、Lan Na Wild 民宿，都在山頂上，山路陡峭又彎曲。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'mtn3',
      style: 'normal',
      children: [{ _type: 'span', _key: 'mtn3a', text: '即使是我們配合多年、技術很好的包車司機大哥，也都是先開到湄康蓬村（Mae Kampong），再換成當地的雙條車上去。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'mtn4',
      style: 'normal',
      children: [{ _type: 'span', _key: 'mtn4a', text: '2023 年 7 月我第一次來清邁玩，Min 先開車大約兩小時到山腳下，然後我們換當地的車才上山。那段山路真的不是一般車能開的。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'mtn5',
      style: 'normal',
      children: [{ _type: 'span', _key: 'mtn5a', text: '有些同行的包車司機可能會拍胸脯說「沒問題啦，我開上去過很多次」，然後直接開上去。但我們的原則是：不是看司機敢不敢，而是我們完全不敢讓客人冒這個風險。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'mtn6',
      style: 'normal',
      children: [{ _type: 'span', _key: 'mtn6a', text: '山路出過事故，這不是網路上的都市傳說，是當地導遊親口告訴我們的。車子可以修，人沒辦法重來。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'mtn7',
      style: 'normal',
      children: [{ _type: 'span', _key: 'mtn7a', text: '這種情況在清邁很多山區景點都會遇到，不只巨樹咖啡。如果你的行程有安排山上的景點，記得事先確認是否需要換車，這是正常的，不是司機偷懶。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'h2_9',
      style: 'h2',
      children: [{ _type: 'span', _key: 'h2_9a', text: '皮卡車：潑水節限定體驗' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'pickup1',
      style: 'normal',
      children: [{ _type: 'span', _key: 'pickup1a', text: '最後補充一種車：皮卡車（Pickup Truck）。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'pickup2',
      style: 'normal',
      children: [{ _type: 'span', _key: 'pickup2a', text: '潑水節期間，你會看到很多泰國人站在皮卡車後面，一邊被潑水、一邊潑別人，整車人玩得超開心。這是很道地的泰國體驗，但觀光客通常參與不了。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'pickup3',
      style: 'normal',
      children: [{ _type: 'span', _key: 'pickup3a', text: '原因是：這種車要預訂，而且通常是泰國人自己組團租的。平常日子根本看不到，除非你自己有一台皮卡車。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'pickup4',
      style: 'normal',
      children: [{ _type: 'span', _key: 'pickup4a', text: '如果你有泰國朋友邀請，潑水節期間可以跟著一起玩，那個體驗真的很難忘。沒有的話也沒關係，路邊一樣可以玩得很瘋。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'h2_10',
      style: 'h2',
      children: [{ _type: 'span', _key: 'h2_10a', text: '親子家庭的交通痛點' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'family1',
      style: 'normal',
      children: [{ _type: 'span', _key: 'family1a', text: '我自己是爸爸，女兒 Miya 出生後，我才真正理解帶小孩出門有多不容易。以下是親子家庭在清邁交通上最常遇到的問題：' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'family2',
      style: 'normal',
      children: [
        { _type: 'span', _key: 'family2a', text: '安全座椅：', marks: ['strong'] },
        { _type: 'span', _key: 'family2b', text: 'Grab 沒有提供，雙條車更不可能有。如果你的小孩還小，這是最大的痛點。包車可以事先預約安全座椅，這也是我們清微旅行一定會準備的配備。' }
      ],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'family3',
      style: 'normal',
      children: [
        { _type: 'span', _key: 'family3a', text: '嬰兒車收納：', marks: ['strong'] },
        { _type: 'span', _key: 'family3b', text: '雙條車後面空間有限，推車很難放。包車有後車廂，可以整台推車直接收進去。' }
      ],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'family4',
      style: 'normal',
      children: [
        { _type: 'span', _key: 'family4a', text: '冷氣：', marks: ['strong'] },
        { _type: 'span', _key: 'family4b', text: '清邁白天很熱，尤其是 3-5 月。雙條車沒有冷氣，小孩坐一下就開始番、開始哭。包車全程冷氣，小孩在車上還能睡一下補眠。' }
      ],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'family5',
      style: 'normal',
      children: [
        { _type: 'span', _key: 'family5a', text: '趕行程壓力：', marks: ['strong'] },
        { _type: 'span', _key: 'family5b', text: '如果你參加拼團的一日遊，時間是固定的。小孩想上廁所、想休息、想多玩一下，都沒辦法配合。包車最大的好處就是行程可以隨時調整，完全照你的節奏走。' }
      ],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'h2_11',
      style: 'h2',
      children: [{ _type: 'span', _key: 'h2_11a', text: '常見問題 FAQ' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'faq1',
      style: 'normal',
      children: [
        { _type: 'span', _key: 'faq1a', text: 'Q1: 清邁機場到市區怎麼去最划算？', marks: ['strong'] }
      ],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'faq1a',
      style: 'normal',
      children: [{ _type: 'span', _key: 'faq1aa', text: 'A: 用 Grab 或 Bolt，大約 150-200 泰銖，價格透明、不用殺價，最穩。機場也有排班計程車，但價格通常比 Grab 貴。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'faq2',
      style: 'normal',
      children: [
        { _type: 'span', _key: 'faq2a', text: 'Q2: KKday/Klook 的一日遊可以買嗎？', marks: ['strong'] }
      ],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'faq2a',
      style: 'normal',
      children: [{ _type: 'span', _key: 'faq2aa', text: 'A: 可以，價格確實便宜，大平台的議價能力強。但大部分是拼團車，司機品質參差不齊。建議下單前先看評論，有些雷從評論就看得出來。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'faq3',
      style: 'normal',
      children: [
        { _type: 'span', _key: 'faq3a', text: 'Q3: 帶小孩適合租機車嗎？', marks: ['strong'] }
      ],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'faq3a',
      style: 'normal',
      children: [{ _type: 'span', _key: 'faq3aa', text: 'A: 不建議。機車沒辦法裝安全座椅，泰國交通規則跟台灣不同，路況也比較複雜。帶小孩的話，安全永遠擺第一。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'faq4',
      style: 'normal',
      children: [
        { _type: 'span', _key: 'faq4a', text: 'Q4: 包車一天大概多少錢？', marks: ['strong'] }
      ],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'faq4a',
      style: 'normal',
      children: [{ _type: 'span', _key: 'faq4aa', text: 'A: 看車型和行程距離。一般 4 人座清邁市區近郊，大約 2,500-3,500 泰銖/天。如果去清萊（來回約 6~7 小時車程），價格會再高一些。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'h2_12',
      style: 'h2',
      children: [{ _type: 'span', _key: 'h2_12a', text: '結語' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'end1',
      style: 'normal',
      children: [{ _type: 'span', _key: 'end1a', text: '清邁交通沒有標準答案，要看你的行程安排和旅伴組成。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'end2',
      style: 'normal',
      children: [{ _type: 'span', _key: 'end2a', text: '市區內走跳，Grab 和 Bolt 就很夠用。想去遠一點的地方，或是帶小孩、帶長輩，包車會讓你的旅程輕鬆很多。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'end3',
      style: 'normal',
      children: [{ _type: 'span', _key: 'end3a', text: '不管選哪種方式，最重要的是：不要因為交通問題壞了整趟旅行的心情。出來玩就是要開心的，不是來跟司機吵架、在路邊等車等到中暑的。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'end4',
      style: 'normal',
      children: [{ _type: 'span', _key: 'end4a', text: '清邁是一個很適合放慢腳步的城市，選對交通方式，你才能真正享受這裡的 Sabai Sabai。' }],
      markDefs: [],
    },
    {
      _type: 'block',
      _key: 'cta',
      style: 'normal',
      children: [{ _type: 'span', _key: 'ctaa', text: '📍 不想煩惱交通？清微旅行提供專業司機 + 中文導遊，可預約兒童安全座椅，行程彈性不趕路。👉 LINE 免費諮詢：https://line.me/R/ti/p/@037nyuwk' }],
      markDefs: [],
    },
  ],
}

async function upload() {
  try {
    const result = await client.create(post)
    console.log('Post created:', result._id)
    console.log('Title:', result.title)
    console.log('Slug:', result.slug.current)

    // Publish the document
    await client
      .patch(result._id)
      .set({ _id: result._id.replace('drafts.', '') })
      .commit()

    console.log('Post published successfully!')
  } catch (error) {
    console.error('Error:', error.message)
  }
}

upload()
