import type { ThaiChildCategory, ThaiParentCategory, ThaiPhrase } from './types'

export const parentCategories: ThaiParentCategory[] = [
  {
    id: 'basics',
    label: '基本溝通',
    shortLabel: '基本',
    description: '招呼、禮貌、可以不可以、聽不懂時先穩住場面。',
    order: 10,
  },
  {
    id: 'food',
    label: '餐廳點餐',
    shortLabel: '餐廳',
    description: '點餐、口味調整、過敏禁忌、兒童餐具與結帳。',
    order: 20,
  },
  {
    id: 'transport',
    label: '包車交通',
    shortLabel: '包車',
    description: '跟司機確認路線、停靠、等待、機場時間與乘車安全。',
    order: 30,
  },
  {
    id: 'family',
    label: '親子需求',
    shortLabel: '親子',
    description: '小孩上廁所、暈車、休息、喝水與兒童椅等旅行現場需求。',
    order: 40,
  },
  {
    id: 'massage',
    label: '按摩放鬆',
    shortLabel: '按摩',
    description: '預約、時間、力道、身體部位與不舒服時的表達。',
    order: 50,
  },
  {
    id: 'hotel-airport',
    label: '飯店機場',
    shortLabel: '飯店',
    description: '入住退房、行李寄放、叫車、接送集合與機場移動。',
    order: 60,
  },
  {
    id: 'shopping',
    label: '市集購物',
    shortLabel: '市集',
    description: '問價格、殺價、選購、刷卡與袋子包裝。',
    order: 70,
  },
  {
    id: 'emergency',
    label: '緊急求助',
    shortLabel: '求助',
    description: '藥局、醫院、症狀、迷路與請人協助聯絡。',
    order: 80,
  },
]

export const childCategories: ThaiChildCategory[] = [
  { id: 'greetings', parentId: 'basics', label: '招呼禮貌', description: '先開口、先謝謝、先道歉。', order: 10 },
  { id: 'yes-no', parentId: 'basics', label: '可以不可以', description: '最短回答先學起來。', order: 20 },
  { id: 'questions', parentId: 'basics', label: '常用問句', description: '請問與聽不懂時使用。', order: 30 },
  { id: 'ordering', parentId: 'food', label: '點餐', description: '看菜單、我要這個、要水。', order: 10 },
  { id: 'taste', parentId: 'food', label: '口味調整', description: '不辣、少辣、少甜、不要冰。', order: 20 },
  { id: 'allergies', parentId: 'food', label: '過敏禁忌', description: '避免小孩吃到不適合的食物。', order: 30 },
  { id: 'kids', parentId: 'food', label: '兒童用餐', description: '兒童碗、兒童湯匙等。', order: 40 },
  { id: 'payment', parentId: 'food', label: '結帳打包', description: '問價格、買單、打包。', order: 50 },
  { id: 'driver', parentId: 'transport', label: '司機溝通', description: '去這裡、停這裡、我們到了。', order: 10 },
  { id: 'route', parentId: 'transport', label: '路線方向', description: '左轉、右轉、直走。', order: 20 },
  { id: 'timing', parentId: 'transport', label: '時間等待', description: '等待、回來時間、塞車。', order: 30 },
  { id: 'airport', parentId: 'transport', label: '機場接送', description: '去機場與時間確認。', order: 40 },
  { id: 'safety', parentId: 'transport', label: '乘車安全', description: '請慢慢開、停一下。', order: 50 },
  { id: 'toilet', parentId: 'family', label: '廁所', description: '小孩想上廁所與找廁所。', order: 10 },
  { id: 'comfort', parentId: 'family', label: '休息舒適', description: '太熱、喝水、休息、肚子餓。', order: 20 },
  { id: 'motion-sickness', parentId: 'family', label: '暈車不舒服', description: '暈車與身體不適。', order: 30 },
  { id: 'baby', parentId: 'family', label: '小小孩需求', description: '兒童椅等小孩用品。', order: 40 },
  { id: 'booking', parentId: 'massage', label: '預約詢問', description: '現在可不可以、需要多久。', order: 10 },
  { id: 'pressure', parentId: 'massage', label: '力道調整', description: '小力、大力、太大力。', order: 20 },
  { id: 'body-parts', parentId: 'massage', label: '身體部位', description: '肩膀等部位需求。', order: 30 },
  { id: 'discomfort', parentId: 'massage', label: '不舒服疼痛', description: '這裡會痛。', order: 40 },
  { id: 'massage-payment', parentId: 'massage', label: '時間付款', description: '價格與付款確認。', order: 50 },
  { id: 'checkin', parentId: 'hotel-airport', label: '入住退房', description: '訂房與退房時間。', order: 10 },
  { id: 'luggage', parentId: 'hotel-airport', label: '行李寄放', description: '寄放行李。', order: 20 },
  { id: 'room', parentId: 'hotel-airport', label: '房間需求', description: '毛巾等房內用品。', order: 30 },
  { id: 'help', parentId: 'hotel-airport', label: '請飯店協助', description: '請飯店幫忙叫車。', order: 40 },
  { id: 'pickup', parentId: 'hotel-airport', label: '接送集合', description: '飯店與機場接送。', order: 50 },
  { id: 'price', parentId: 'shopping', label: '價格詢問', description: '問價格與覺得太貴。', order: 10 },
  { id: 'bargaining', parentId: 'shopping', label: '殺價', description: '請店家便宜一點。', order: 20 },
  { id: 'choosing', parentId: 'shopping', label: '挑選購買', description: '我要這個。', order: 30 },
  { id: 'shopping-payment', parentId: 'shopping', label: '付款方式', description: '刷卡與現金付款。', order: 40 },
  { id: 'packaging', parentId: 'shopping', label: '袋子包裝', description: '不需要袋子。', order: 50 },
  { id: 'pharmacy', parentId: 'emergency', label: '藥局', description: '找藥局。', order: 10 },
  { id: 'hospital', parentId: 'emergency', label: '醫院', description: '找醫院。', order: 20 },
  { id: 'symptoms', parentId: 'emergency', label: '症狀', description: '肚子痛、過敏。', order: 30 },
  { id: 'lost', parentId: 'emergency', label: '迷路遺失', description: '迷路時使用。', order: 40 },
  { id: 'contact', parentId: 'emergency', label: '聯絡協助', description: '請別人幫忙打電話。', order: 50 },
]

type PhraseInput = Omit<ThaiPhrase, 'audio'>

const genderNote = 'Min 錄音示範女生版；男生可把句尾 ค่ะ / คะ 換成 ครับ。'

function withAudio(phrase: PhraseInput): ThaiPhrase {
  return {
    ...phrase,
    audio: {
      slow: `/audio/thai/${phrase.parentId}/${phrase.childId}/${phrase.id}-slow.mp3`,
      natural: `/audio/thai/${phrase.parentId}/${phrase.childId}/${phrase.id}-natural.mp3`,
    },
  }
}

export const thaiPhrases: ThaiPhrase[] = [
  withAudio({ id: 'sawasdee-kha', parentId: 'basics', childId: 'greetings', level: 'phrase', chinese: '你好', thai: 'สวัสดีค่ะ', romanization: 'sa-wat-dii kha', zhuyinHint: 'ㄙㄚ ㄨㄚˇ ㄉㄧ ㄎㄚ', usage: '見到司機、店員、飯店人員時都可以先說。', genderNote, tags: ['招呼', '禮貌'], priority: 1, isStarter: true }),
  withAudio({ id: 'khop-khun-kha', parentId: 'basics', childId: 'greetings', level: 'phrase', chinese: '謝謝', thai: 'ขอบคุณค่ะ', romanization: 'khop khun kha', zhuyinHint: 'ㄎㄛˋ ㄎㄨㄣ ㄎㄚ', usage: '司機幫忙拿行李、店員送餐、導遊協助時都很常用。', genderNote, tags: ['禮貌'], priority: 2, isStarter: true }),
  withAudio({ id: 'kho-thot-kha', parentId: 'basics', childId: 'greetings', level: 'phrase', chinese: '不好意思 / 對不起', thai: 'ขอโทษค่ะ', romanization: 'kho thot kha', zhuyinHint: 'ㄎㄛˇ ㄊㄛˋ ㄎㄚ', usage: '要請人讓一下、打擾別人、或需要道歉時使用。', genderNote, tags: ['禮貌'], priority: 3 }),
  withAudio({ id: 'mai-pen-rai-kha', parentId: 'basics', childId: 'greetings', level: 'phrase', chinese: '沒關係', thai: 'ไม่เป็นไรค่ะ', romanization: 'mai pen rai kha', zhuyinHint: 'ㄇㄞˋ ㄅㄣ ㄌㄞ ㄎㄚ', usage: '對方道歉或小狀況發生時，可以溫和回應。', genderNote, tags: ['禮貌'], priority: 4 }),
  withAudio({ id: 'chai-kha', parentId: 'basics', childId: 'yes-no', level: 'word', chinese: '是 / 對', thai: 'ใช่ค่ะ', romanization: 'chai kha', zhuyinHint: 'ㄔㄞˋ ㄎㄚ', usage: '確認資訊時的簡短回答。', genderNote, tags: ['回答'], priority: 5 }),
  withAudio({ id: 'mai-chai-kha', parentId: 'basics', childId: 'yes-no', level: 'phrase', chinese: '不是', thai: 'ไม่ใช่ค่ะ', romanization: 'mai chai kha', zhuyinHint: 'ㄇㄞˋ ㄔㄞˋ ㄎㄚ', usage: '對方理解錯時使用，語氣保持輕。', genderNote, tags: ['回答'], priority: 6 }),
  withAudio({ id: 'dai-kha', parentId: 'basics', childId: 'yes-no', level: 'word', chinese: '可以', thai: 'ได้ค่ะ', romanization: 'dai kha', zhuyinHint: 'ㄉㄞˋ ㄎㄚ', usage: '確認可以、沒問題時使用。', genderNote, tags: ['回答'], priority: 7 }),
  withAudio({ id: 'mai-dai-kha', parentId: 'basics', childId: 'yes-no', level: 'phrase', chinese: '不可以', thai: 'ไม่ได้ค่ะ', romanization: 'mai dai kha', zhuyinHint: 'ㄇㄞˋ ㄉㄞˋ ㄎㄚ', usage: '表示不行或做不到。', genderNote, tags: ['回答'], priority: 8 }),
  withAudio({ id: 'kho-tham-noi-kha', parentId: 'basics', childId: 'questions', level: 'sentence', chinese: '請問一下', thai: 'ขอถามหน่อยค่ะ', romanization: 'kho tham noi kha', zhuyinHint: 'ㄎㄛˇ ㄊㄚㄇ ㄋㄛㄧˇ ㄎㄚ', usage: '問路、問價格、問規則前的開場。', genderNote, tags: ['問句'], priority: 9 }),
  withAudio({ id: 'fang-thai-mai-khao-jai-kha', parentId: 'basics', childId: 'questions', level: 'sentence', chinese: '我聽不懂泰文', thai: 'ฟังภาษาไทยไม่เข้าใจค่ะ', romanization: 'fang pha-sa thai mai khao-jai kha', zhuyinHint: 'ㄈㄤ ㄆㄚ ㄙㄚ ㄊㄞ ㄇㄞˋ ㄎㄠˋ ㄐㄞ ㄎㄚ', usage: '對方講太快時，先讓對方知道你聽不懂。', genderNote, tags: ['問句', '救援'], priority: 10 }),

  withAudio({ id: 'ao-an-ni-kha', parentId: 'food', childId: 'ordering', level: 'sentence', chinese: '我要這個', thai: 'เอาอันนี้ค่ะ', romanization: 'ao an ni kha', zhuyinHint: 'ㄠ ㄢ ㄋㄧˋ ㄎㄚ', usage: '看菜單或指著餐點點餐時使用。', genderNote, tags: ['餐廳', '點餐'], priority: 11, isStarter: true }),
  withAudio({ id: 'ao-nam-nueng-khuat-kha', parentId: 'food', childId: 'ordering', level: 'sentence', chinese: '我要一瓶水', thai: 'เอาน้ำหนึ่งขวดค่ะ', romanization: 'ao nam nueng khuat kha', zhuyinHint: 'ㄠ ㄋㄚㄇˊ ㄋㄥˋ ㄎㄨㄚˋ ㄎㄚ', usage: '餐廳、市集、車上需要水時都可用。', genderNote, tags: ['餐廳', '水'], priority: 12 }),
  withAudio({ id: 'kho-du-menu-noi-kha', parentId: 'food', childId: 'ordering', level: 'sentence', chinese: '可以看菜單嗎', thai: 'ขอดูเมนูหน่อยค่ะ', romanization: 'kho du menu noi kha', zhuyinHint: 'ㄎㄛˇ ㄉㄨ ㄇㄟ ㄋㄨ ㄋㄛㄧˇ ㄎㄚ', usage: '入座後或想先看菜單時使用。', genderNote, tags: ['餐廳', '點餐'], priority: 13 }),
  withAudio({ id: 'mai-phet-kha', parentId: 'food', childId: 'taste', level: 'phrase', chinese: '不要辣', thai: 'ไม่เอาเผ็ดค่ะ', romanization: 'mai ao phet kha', zhuyinHint: 'ㄇㄞˋ ㄠ ㄆㄟˋ ㄎㄚ', usage: '點餐時表達不要做辣；比「ไม่เผ็ดค่ะ」更像是在下單要求。', genderNote, tags: ['餐廳', '不辣', '親子'], priority: 14, isStarter: true }),
  withAudio({ id: 'phet-noi-kha', parentId: 'food', childId: 'taste', level: 'phrase', chinese: '少辣', thai: 'เผ็ดน้อยค่ะ', romanization: 'phet noi kha', zhuyinHint: 'ㄆㄟˋ ㄋㄛㄧˇ ㄎㄚ', usage: '想保留一點泰式味道，但不要太辣時使用。', genderNote, tags: ['餐廳', '少辣'], priority: 15 }),
  withAudio({ id: 'mai-ao-nam-khaeng-kha', parentId: 'food', childId: 'taste', level: 'sentence', chinese: '不要冰', thai: 'ไม่เอาน้ำแข็งค่ะ', romanization: 'mai ao nam khaeng kha', zhuyinHint: 'ㄇㄞˋ ㄠ ㄋㄚㄇˊ ㄎㄥˇ ㄎㄚ', usage: '點飲料或給小孩喝水時使用。', genderNote, tags: ['餐廳', '飲料'], priority: 16 }),
  withAudio({ id: 'wan-noi-kha', parentId: 'food', childId: 'taste', level: 'phrase', chinese: '少甜', thai: 'หวานน้อยค่ะ', romanization: 'wan noi kha', zhuyinHint: 'ㄨㄢ ㄋㄛㄧˇ ㄎㄚ', usage: '點泰奶、果汁、咖啡時很實用。', genderNote, tags: ['餐廳', '飲料'], priority: 17 }),
  withAudio({ id: 'mai-sai-thua-kha', parentId: 'food', childId: 'allergies', level: 'phrase', chinese: '不要花生', thai: 'ไม่ใส่ถั่วค่ะ', romanization: 'mai sai thua kha', zhuyinHint: 'ㄇㄞˋ ㄙㄞˋ ㄊㄨㄚˇ ㄎㄚ', usage: '有花生過敏或不想加花生時使用。', genderNote, tags: ['餐廳', '過敏'], priority: 18 }),
  withAudio({ id: 'dek-gin-phet-mai-dai-kha', parentId: 'food', childId: 'allergies', level: 'sentence', chinese: '小孩不能吃辣', thai: 'เด็กกินเผ็ดไม่ได้ค่ะ', romanization: 'dek gin phet mai dai kha', zhuyinHint: 'ㄉㄟˋ ㄍㄧㄣ ㄆㄟˋ ㄇㄞˋ ㄉㄞˋ ㄎㄚ', usage: '幫小孩點餐時，比只說不辣更清楚。', genderNote, tags: ['餐廳', '親子'], priority: 19 }),
  withAudio({ id: 'mi-thuai-dek-mai-kha', parentId: 'food', childId: 'kids', level: 'sentence', chinese: '有兒童碗嗎', thai: 'มีถ้วยเด็กไหมคะ', romanization: 'mi thuai dek mai kha', zhuyinHint: 'ㄇㄧ ㄊㄨㄟˇ ㄉㄟˋ ㄇㄞˇ ㄎㄚ', usage: '餐廳有小孩同行時使用。', genderNote, tags: ['餐廳', '親子'], priority: 20 }),
  withAudio({ id: 'mi-chon-dek-mai-kha', parentId: 'food', childId: 'kids', level: 'sentence', chinese: '有兒童湯匙嗎', thai: 'มีช้อนเด็กไหมคะ', romanization: 'mi chon dek mai kha', zhuyinHint: 'ㄇㄧ ㄔㄛㄣˋ ㄉㄟˋ ㄇㄞˇ ㄎㄚ', usage: '需要小孩比較好拿的餐具時使用。', genderNote, tags: ['餐廳', '親子'], priority: 21 }),
  withAudio({ id: 'tao-rai-kha', parentId: 'food', childId: 'payment', level: 'phrase', chinese: '多少錢', thai: 'เท่าไหร่คะ', romanization: 'tao rai kha', zhuyinHint: 'ㄊㄠˋ ㄌㄞˇ ㄎㄚ', usage: '餐廳、市集、按摩都能用。', genderNote, tags: ['價格'], priority: 22 }),
  withAudio({ id: 'check-bin-kha', parentId: 'food', childId: 'payment', level: 'phrase', chinese: '買單', thai: 'เช็คบิลค่ะ', romanization: 'check bin kha', zhuyinHint: 'ㄔㄟˋ ㄅㄧㄣ ㄎㄚ', usage: '吃完飯要結帳時使用。', genderNote, tags: ['餐廳', '結帳'], priority: 23 }),
  withAudio({ id: 'ho-klap-ban-dai-mai-kha', parentId: 'food', childId: 'payment', level: 'sentence', chinese: '可以打包嗎', thai: 'ห่อกลับบ้านได้ไหมคะ', romanization: 'ho klap ban dai mai kha', zhuyinHint: 'ㄏㄛˋ ㄍㄌㄚˋ ㄅㄢˋ ㄉㄞˋ ㄇㄞˇ ㄎㄚ', usage: '小孩吃不完、份量太多時使用。', genderNote, tags: ['餐廳', '打包'], priority: 24 }),

  withAudio({ id: 'pai-thi-ni-kha', parentId: 'transport', childId: 'driver', level: 'sentence', chinese: '我們要去這裡', thai: 'ไปที่นี่ค่ะ', romanization: 'pai thi ni kha', zhuyinHint: 'ㄅㄞ ㄊㄧˋ ㄋㄧˋ ㄎㄚ', usage: '拿地圖或手機地址給司機看時使用。', genderNote, tags: ['包車', '司機'], priority: 25 }),
  withAudio({ id: 'chot-trong-ni-kha', parentId: 'transport', childId: 'driver', level: 'sentence', chinese: '請停這裡', thai: 'จอดตรงนี้ค่ะ', romanization: 'chot trong ni kha', zhuyinHint: 'ㄐㄛˋ ㄉㄌㄛㄥ ㄋㄧˋ ㄎㄚ', usage: '抵達景點、餐廳、拍照點時使用。', genderNote, tags: ['包車', '司機'], priority: 26, isStarter: true }),
  withAudio({ id: 'ro-sak-khru-na-kha', parentId: 'transport', childId: 'timing', level: 'sentence', chinese: '請等一下', thai: 'รอสักครู่นะคะ', romanization: 'ro sak khru na kha', zhuyinHint: 'ㄌㄛ ㄙㄚˋ ㄎㄨㄥˋ ㄋㄚ ㄎㄚ', usage: '整理東西、小孩還沒上車、要拿行李時使用。', genderNote, tags: ['包車', '等待'], priority: 27 }),
  withAudio({ id: 'klap-ma-ki-mong-kha', parentId: 'transport', childId: 'timing', level: 'sentence', chinese: '幾點回來', thai: 'กลับมากี่โมงคะ', romanization: 'klap ma ki mong kha', zhuyinHint: 'ㄍㄌㄚˋ ㄇㄚ ㄍㄧˋ ㄇㄛㄥ ㄎㄚ', usage: '下車自由活動前，跟司機確認集合時間。', genderNote, tags: ['包車', '時間'], priority: 28 }),
  withAudio({ id: 'thueng-laew-kha', parentId: 'transport', childId: 'driver', level: 'phrase', chinese: '我們到了', thai: 'ถึงแล้วค่ะ', romanization: 'thueng laew kha', zhuyinHint: 'ㄊㄥˊ ㄌㄟˊ ㄎㄚ', usage: '確認已到目的地，或跟同行家人說到了。', genderNote, tags: ['包車'], priority: 29 }),
  withAudio({ id: 'liao-sai-kha', parentId: 'transport', childId: 'route', level: 'phrase', chinese: '左轉', thai: 'เลี้ยวซ้ายค่ะ', romanization: 'liao sai kha', zhuyinHint: 'ㄌㄧㄠˋ ㄙㄞˋ ㄎㄚ', usage: '需要簡單指路時使用。', genderNote, tags: ['路線'], priority: 30 }),
  withAudio({ id: 'liao-khwa-kha', parentId: 'transport', childId: 'route', level: 'phrase', chinese: '右轉', thai: 'เลี้ยวขวาค่ะ', romanization: 'liao khwa kha', zhuyinHint: 'ㄌㄧㄠˋ ㄎㄨㄚˇ ㄎㄚ', usage: '需要簡單指路時使用。', genderNote, tags: ['路線'], priority: 31 }),
  withAudio({ id: 'trong-pai-kha', parentId: 'transport', childId: 'route', level: 'phrase', chinese: '直走', thai: 'ตรงไปค่ะ', romanization: 'trong pai kha', zhuyinHint: 'ㄉㄌㄛㄥ ㄅㄞ ㄎㄚ', usage: '需要簡單指路時使用。', genderNote, tags: ['路線'], priority: 32 }),
  withAudio({ id: 'pai-sanam-bin-kha', parentId: 'transport', childId: 'airport', level: 'sentence', chinese: '我們要去機場', thai: 'ไปสนามบินค่ะ', romanization: 'pai sanam bin kha', zhuyinHint: 'ㄅㄞ ㄙㄚ ㄋㄚㄇ ㄅㄧㄣ ㄎㄚ', usage: '機場接送或飯店叫車時使用。', genderNote, tags: ['機場', '包車'], priority: 33 }),
  withAudio({ id: 'pai-sanam-bin-than-mai-kha', parentId: 'transport', childId: 'airport', level: 'sentence', chinese: '去機場來得及嗎', thai: 'ไปสนามบินทันไหมคะ', romanization: 'pai sanam bin than mai kha', zhuyinHint: 'ㄅㄞ ㄙㄚ ㄋㄚㄇ ㄅㄧㄣ ㄊㄢ ㄇㄞˇ ㄎㄚ', usage: '塞車或時間緊時，跟司機確認。', genderNote, tags: ['機場', '時間'], priority: 34 }),
  withAudio({ id: 'rot-tit-mai-kha', parentId: 'transport', childId: 'timing', level: 'sentence', chinese: '會塞車嗎', thai: 'รถติดไหมคะ', romanization: 'rot tit mai kha', zhuyinHint: 'ㄌㄛˋ ㄉㄧˋ ㄇㄞˇ ㄎㄚ', usage: '出發前想知道路況時使用。', genderNote, tags: ['包車', '路況'], priority: 35 }),
  withAudio({ id: 'khap-cha-noi-dai-mai-kha', parentId: 'transport', childId: 'safety', level: 'sentence', chinese: '可以開慢一點嗎', thai: 'ขับช้าหน่อยได้ไหมคะ', romanization: 'khap cha noi dai mai kha', zhuyinHint: 'ㄎㄚˋ ㄔㄚˊ ㄋㄛㄧˇ ㄉㄞˋ ㄇㄞˇ ㄎㄚ', usage: '小孩暈車、山路或你覺得速度太快時使用。', genderNote, tags: ['包車', '安全'], priority: 36 }),
  withAudio({ id: 'chot-thai-rup-paep-nueng-dai-mai-kha', parentId: 'transport', childId: 'driver', level: 'sentence', chinese: '可以停一下拍照嗎', thai: 'จอดถ่ายรูปแป๊บหนึ่งได้ไหมคะ', romanization: 'chot thai rup paep nueng dai mai kha', zhuyinHint: 'ㄐㄛˋ ㄊㄞˋ ㄌㄨˋ ㄅㄟˋ ㄋㄥˋ ㄉㄞˋ ㄇㄞˇ ㄎㄚ', usage: '路上看到漂亮景色、想臨停拍照時使用。', genderNote, tags: ['包車', '拍照'], priority: 37 }),
  withAudio({ id: 'chot-khao-hong-nam-paep-nueng-dai-mai-kha', parentId: 'transport', childId: 'driver', level: 'sentence', chinese: '可以停一下上廁所嗎', thai: 'จอดเข้าห้องน้ำแป๊บหนึ่งได้ไหมคะ', romanization: 'chot khao hong nam paep nueng dai mai kha', zhuyinHint: 'ㄐㄛˋ ㄎㄠˋ ㄏㄛㄥˋ ㄋㄚㄇˊ ㄅㄟˋ ㄋㄥˋ ㄉㄞˋ ㄇㄞˇ ㄎㄚ', usage: '長途移動、小孩臨時想上廁所時使用。', genderNote, tags: ['包車', '廁所'], priority: 38 }),

  withAudio({ id: 'dek-yak-khao-hong-nam-kha', parentId: 'family', childId: 'toilet', level: 'sentence', chinese: '小孩想上廁所', thai: 'เด็กอยากเข้าห้องน้ำค่ะ', romanization: 'dek yak khao hong nam kha', zhuyinHint: 'ㄉㄟˋ ㄧㄚˋ ㄎㄠˋ ㄏㄛㄥˋ ㄋㄚㄇˊ ㄎㄚ', usage: '餐廳、景點、車上都很常用。', genderNote, tags: ['親子', '廁所'], priority: 39 }),
  withAudio({ id: 'hong-nam-yu-thi-nai-kha', parentId: 'family', childId: 'toilet', level: 'sentence', chinese: '廁所在哪裡', thai: 'ห้องน้ำอยู่ที่ไหนคะ', romanization: 'hong nam yu thi nai kha', zhuyinHint: 'ㄏㄛㄥˋ ㄋㄚㄇˊ ㄩˋ ㄊㄧˋ ㄋㄞˇ ㄎㄚ', usage: '找廁所時最重要的一句。', genderNote, tags: ['廁所'], priority: 40 }),
  withAudio({ id: 'phak-paep-nueng-dai-mai-kha', parentId: 'family', childId: 'comfort', level: 'sentence', chinese: '可以休息一下嗎', thai: 'พักแป๊บหนึ่งได้ไหมคะ', romanization: 'phak paep nueng dai mai kha', zhuyinHint: 'ㄆㄚˋ ㄅㄟˋ ㄋㄥˋ ㄉㄞˋ ㄇㄞˇ ㄎㄚ', usage: '天氣熱、小孩累、行程中想暫停時使用。', genderNote, tags: ['親子', '休息'], priority: 41 }),
  withAudio({ id: 'ron-mak-kha', parentId: 'family', childId: 'comfort', level: 'phrase', chinese: '太熱了', thai: 'ร้อนมากค่ะ', romanization: 'ron mak kha', zhuyinHint: 'ㄌㄛㄣˋ ㄇㄚˋ ㄎㄚ', usage: '需要找陰影、冷氣或休息時可以先表達。', genderNote, tags: ['親子', '天氣'], priority: 42 }),
  withAudio({ id: 'kho-nam-noi-kha', parentId: 'family', childId: 'comfort', level: 'sentence', chinese: '我們需要水', thai: 'ขอน้ำหน่อยค่ะ', romanization: 'kho nam noi kha', zhuyinHint: 'ㄎㄛˇ ㄋㄚㄇˊ ㄋㄛㄧˇ ㄎㄚ', usage: '車上、餐廳、飯店需要水時都能用。', genderNote, tags: ['親子', '水'], priority: 43 }),
  withAudio({ id: 'dek-mao-rot-kha', parentId: 'family', childId: 'motion-sickness', level: 'sentence', chinese: '小孩暈車', thai: 'เด็กเมารถค่ะ', romanization: 'dek mao rot kha', zhuyinHint: 'ㄉㄟˋ ㄇㄠ ㄌㄛˋ ㄎㄚ', usage: '山路、長途包車、孩子不舒服時先讓司機知道。', genderNote, tags: ['親子', '暈車'], priority: 44 }),
  withAudio({ id: 'dek-mai-sabai-kha', parentId: 'family', childId: 'motion-sickness', level: 'sentence', chinese: '小孩不舒服', thai: 'เด็กไม่สบายค่ะ', romanization: 'dek mai sabai kha', zhuyinHint: 'ㄉㄟˋ ㄇㄞˋ ㄙㄚ ㄅㄞ ㄎㄚ', usage: '孩子身體狀況不明確時可先使用。', genderNote, tags: ['親子', '不舒服'], priority: 45 }),
  withAudio({ id: 'dek-hiu-laew-kha', parentId: 'family', childId: 'comfort', level: 'sentence', chinese: '小孩餓了', thai: 'เด็กหิวแล้วค่ะ', romanization: 'dek hiu laew kha', zhuyinHint: 'ㄉㄟˋ ㄏㄧㄡˇ ㄌㄟˊ ㄎㄚ', usage: '需要調整行程先吃飯時使用。', genderNote, tags: ['親子', '餐廳'], priority: 46 }),
  withAudio({ id: 'dek-lap-laew-kha', parentId: 'family', childId: 'comfort', level: 'sentence', chinese: '小孩睡著了', thai: 'เด็กหลับแล้วค่ะ', romanization: 'dek lap laew kha', zhuyinHint: 'ㄉㄟˋ ㄌㄚˋ ㄌㄟˊ ㄎㄚ', usage: '請司機或同行者放低音量、調整行程時使用。', genderNote, tags: ['親子'], priority: 47 }),
  withAudio({ id: 'mi-kao-i-dek-mai-kha', parentId: 'family', childId: 'baby', level: 'sentence', chinese: '有兒童椅嗎', thai: 'มีเก้าอี้เด็กไหมคะ', romanization: 'mi kao-i dek mai kha', zhuyinHint: 'ㄇㄧ ㄍㄠˋ ㄧˋ ㄉㄟˋ ㄇㄞˇ ㄎㄚ', usage: '餐廳、咖啡廳有幼兒同行時使用。', genderNote, tags: ['親子', '餐廳'], priority: 48 }),

  withAudio({ id: 'ton-ni-nuat-dai-mai-kha', parentId: 'massage', childId: 'booking', level: 'sentence', chinese: '現在可以按摩嗎', thai: 'ตอนนี้นวดได้ไหมคะ', romanization: 'ton ni nuat dai mai kha', zhuyinHint: 'ㄉㄛㄣ ㄋㄧˋ ㄋㄨㄚˋ ㄉㄞˋ ㄇㄞˇ ㄎㄚ', usage: '走進按摩店詢問是否有空位時使用。', genderNote, tags: ['按摩'], priority: 49 }),
  withAudio({ id: 'chai-we-la-ki-na-thi-kha', parentId: 'massage', childId: 'booking', level: 'sentence', chinese: '要多久時間', thai: 'ใช้เวลากี่นาทีคะ', romanization: 'chai we-la ki na-thi kha', zhuyinHint: 'ㄔㄞˋ ㄨㄟ ㄌㄚ ㄍㄧˋ ㄋㄚ ㄊㄧ ㄎㄚ', usage: '確認按摩時間，避免影響下一個行程。', genderNote, tags: ['按摩', '時間'], priority: 50 }),
  withAudio({ id: 'bao-noi-kha', parentId: 'massage', childId: 'pressure', level: 'phrase', chinese: '小力一點', thai: 'เบาหน่อยค่ะ', romanization: 'bao noi kha', zhuyinHint: 'ㄅㄠ ㄋㄛㄧˇ ㄎㄚ', usage: '按摩力道太重時最實用。', genderNote, tags: ['按摩', '力道'], priority: 51 }),
  withAudio({ id: 'raeng-ik-nit-kha', parentId: 'massage', childId: 'pressure', level: 'phrase', chinese: '大力一點', thai: 'แรงอีกนิดค่ะ', romanization: 'raeng ik nit kha', zhuyinHint: 'ㄌㄥ ㄧˋ ㄋㄧˋ ㄎㄚ', usage: '想要稍微加強力道時使用。', genderNote, tags: ['按摩', '力道'], priority: 52 }),
  withAudio({ id: 'raeng-pai-kha', parentId: 'massage', childId: 'pressure', level: 'phrase', chinese: '太大力了', thai: 'แรงไปค่ะ', romanization: 'raeng pai kha', zhuyinHint: 'ㄌㄥ ㄅㄞ ㄎㄚ', usage: '覺得不舒服時直接講，按摩師會懂。', genderNote, tags: ['按摩', '力道'], priority: 53 }),
  withAudio({ id: 'nuat-lai-dai-mai-kha', parentId: 'massage', childId: 'body-parts', level: 'sentence', chinese: '可以按肩膀嗎', thai: 'นวดไหล่ได้ไหมคะ', romanization: 'nuat lai dai mai kha', zhuyinHint: 'ㄋㄨㄚˋ ㄌㄞˇ ㄉㄞˋ ㄇㄞˇ ㄎㄚ', usage: '肩頸痠痛、想指定部位時使用。', genderNote, tags: ['按摩'], priority: 54 }),
  withAudio({ id: 'trong-ni-jep-kha', parentId: 'massage', childId: 'discomfort', level: 'sentence', chinese: '這裡會痛', thai: 'ตรงนี้เจ็บค่ะ', romanization: 'trong ni jep kha', zhuyinHint: 'ㄉㄌㄛㄥ ㄋㄧˋ ㄐㄟˋ ㄎㄚ', usage: '按摩或身體不舒服時指著部位說。', genderNote, tags: ['按摩', '不舒服'], priority: 55 }),
  withAudio({ id: 'massage-tao-rai-kha', parentId: 'massage', childId: 'massage-payment', level: 'phrase', chinese: '多少錢', thai: 'เท่าไหร่คะ', romanization: 'tao rai kha', zhuyinHint: 'ㄊㄠˋ ㄌㄞˇ ㄎㄚ', usage: '確認按摩價格時使用。', genderNote, tags: ['按摩', '價格'], priority: 56 }),

  withAudio({ id: 'chong-hong-wai-kha', parentId: 'hotel-airport', childId: 'checkin', level: 'sentence', chinese: '我有訂房', thai: 'จองห้องไว้ค่ะ', romanization: 'chong hong wai kha', zhuyinHint: 'ㄐㄛㄥ ㄏㄛㄥˋ ㄨㄞˋ ㄎㄚ', usage: '飯店櫃台入住時使用。', genderNote, tags: ['飯店'], priority: 57 }),
  withAudio({ id: 'checkout-ki-mong-kha', parentId: 'hotel-airport', childId: 'checkin', level: 'sentence', chinese: '幾點退房', thai: 'เช็คเอาท์กี่โมงคะ', romanization: 'check-out ki mong kha', zhuyinHint: 'ㄔㄟˋ ㄠˋ ㄍㄧˋ ㄇㄛㄥ ㄎㄚ', usage: '入住時確認退房時間。', genderNote, tags: ['飯店', '時間'], priority: 58 }),
  withAudio({ id: 'fak-krapao-dai-mai-kha', parentId: 'hotel-airport', childId: 'luggage', level: 'sentence', chinese: '可以寄放行李嗎', thai: 'ฝากกระเป๋าได้ไหมคะ', romanization: 'fak kra-pao dai mai kha', zhuyinHint: 'ㄈㄚˋ ㄍㄌㄚ ㄅㄠ ㄉㄞˋ ㄇㄞˇ ㄎㄚ', usage: '退房後還想玩、或提早抵達飯店時使用。', genderNote, tags: ['飯店', '行李'], priority: 59 }),
  withAudio({ id: 'kho-pha-chet-tua-phoem-dai-mai-kha', parentId: 'hotel-airport', childId: 'room', level: 'sentence', chinese: '可以多一條毛巾嗎', thai: 'ขอผ้าเช็ดตัวเพิ่มได้ไหมคะ', romanization: 'kho pha chet tua phoem dai mai kha', zhuyinHint: 'ㄎㄛˇ ㄆㄚˋ ㄔㄟˋ ㄉㄨㄚ ㄆㄥˋ ㄉㄞˋ ㄇㄞˇ ㄎㄚ', usage: '家庭旅遊常會需要多一條毛巾。', genderNote, tags: ['飯店'], priority: 60 }),
  withAudio({ id: 'chuai-riak-rot-hai-noi-dai-mai-kha', parentId: 'hotel-airport', childId: 'help', level: 'sentence', chinese: '可以幫我叫車嗎', thai: 'ช่วยเรียกรถให้หน่อยได้ไหมคะ', romanization: 'chuai riak rot hai noi dai mai kha', zhuyinHint: 'ㄔㄨㄞˋ ㄌㄧㄚˋ ㄌㄛˋ ㄏㄞˋ ㄋㄛㄧˇ ㄉㄞˋ ㄇㄞˇ ㄎㄚ', usage: '請飯店櫃台協助叫車。', genderNote, tags: ['飯店', '交通'], priority: 61 }),
  withAudio({ id: 'ni-khue-rong-raem-khong-rao-kha', parentId: 'hotel-airport', childId: 'pickup', level: 'sentence', chinese: '這是我們的飯店', thai: 'นี่คือโรงแรมของเราค่ะ', romanization: 'ni khue rong-raem khong rao kha', zhuyinHint: 'ㄋㄧˋ ㄎㄨ ㄌㄛㄥ ㄌㄢ ㄎㄛㄥˇ ㄌㄠ ㄎㄚ', usage: '給司機看飯店資訊或確認接送地點。', genderNote, tags: ['飯店', '包車'], priority: 62 }),
  withAudio({ id: 'rao-cha-pai-sanam-bin-kha', parentId: 'hotel-airport', childId: 'pickup', level: 'sentence', chinese: '我們要去機場', thai: 'เราจะไปสนามบินค่ะ', romanization: 'rao cha pai sanam bin kha', zhuyinHint: 'ㄌㄠ ㄐㄚ ㄅㄞ ㄙㄚ ㄋㄚㄇ ㄅㄧㄣ ㄎㄚ', usage: '飯店、櫃台、司機都能使用。', genderNote, tags: ['機場'], priority: 63 }),

  withAudio({ id: 'an-ni-tao-rai-kha', parentId: 'shopping', childId: 'price', level: 'sentence', chinese: '這個多少錢', thai: 'อันนี้เท่าไหร่คะ', romanization: 'an ni tao rai kha', zhuyinHint: 'ㄢ ㄋㄧˋ ㄊㄠˋ ㄌㄞˇ ㄎㄚ', usage: '夜市、市集、伴手禮店都常用。', genderNote, tags: ['市集', '價格'], priority: 64 }),
  withAudio({ id: 'lot-noi-dai-mai-kha', parentId: 'shopping', childId: 'bargaining', level: 'sentence', chinese: '可以便宜一點嗎', thai: 'ลดหน่อยได้ไหมคะ', romanization: 'lot noi dai mai kha', zhuyinHint: 'ㄌㄛˋ ㄋㄛㄧˇ ㄉㄞˋ ㄇㄞˇ ㄎㄚ', usage: '市集殺價時使用，語氣輕鬆一點。', genderNote, tags: ['市集', '殺價'], priority: 65 }),
  withAudio({ id: 'shopping-ao-an-ni-kha', parentId: 'shopping', childId: 'choosing', level: 'sentence', chinese: '我要這個', thai: 'เอาอันนี้ค่ะ', romanization: 'ao an ni kha', zhuyinHint: 'ㄠ ㄢ ㄋㄧˋ ㄎㄚ', usage: '看好商品、指著要買時使用。', genderNote, tags: ['市集'], priority: 66 }),
  withAudio({ id: 'chai-bat-dai-mai-kha', parentId: 'shopping', childId: 'shopping-payment', level: 'sentence', chinese: '可以刷卡嗎', thai: 'จ่ายบัตรได้ไหมคะ', romanization: 'chai bat dai mai kha', zhuyinHint: 'ㄐㄞˋ ㄅㄚˋ ㄉㄞˋ ㄇㄞˇ ㄎㄚ', usage: '店家或市集攤位想確認能不能刷卡。', genderNote, tags: ['市集', '付款'], priority: 67 }),
  withAudio({ id: 'mai-ao-thung-kha', parentId: 'shopping', childId: 'packaging', level: 'phrase', chinese: '不用袋子', thai: 'ไม่เอาถุงค่ะ', romanization: 'mai ao thung kha', zhuyinHint: 'ㄇㄞˋ ㄠ ㄊㄨㄥˇ ㄎㄚ', usage: '自備袋子或不需要塑膠袋時使用。', genderNote, tags: ['市集'], priority: 68 }),
  withAudio({ id: 'phaeng-pai-kha', parentId: 'shopping', childId: 'price', level: 'phrase', chinese: '太貴了', thai: 'แพงไปค่ะ', romanization: 'phaeng pai kha', zhuyinHint: 'ㄆㄥ ㄅㄞ ㄎㄚ', usage: '市集殺價時可以笑笑地說，避免語氣太硬。', genderNote, tags: ['市集', '價格'], priority: 69 }),

  withAudio({ id: 'ran-khai-ya-yu-thi-nai-kha', parentId: 'emergency', childId: 'pharmacy', level: 'sentence', chinese: '藥局在哪裡', thai: 'ร้านขายยาอยู่ที่ไหนคะ', romanization: 'ran khai ya yu thi nai kha', zhuyinHint: 'ㄌㄢˋ ㄎㄞˇ ㄧㄚ ㄩˋ ㄊㄧˋ ㄋㄞˇ ㄎㄚ', usage: '需要買藥、暈車藥或退燒用品時使用。', genderNote, tags: ['緊急', '藥局'], priority: 70 }),
  withAudio({ id: 'rong-pha-ya-ban-yu-thi-nai-kha', parentId: 'emergency', childId: 'hospital', level: 'sentence', chinese: '醫院在哪裡', thai: 'โรงพยาบาลอยู่ที่ไหนคะ', romanization: 'rong pha-ya-ban yu thi nai kha', zhuyinHint: 'ㄌㄛㄥ ㄆㄚ ㄧㄚ ㄅㄢ ㄩˋ ㄊㄧˋ ㄋㄞˇ ㄎㄚ', usage: '需要找醫院時使用；緊急情況也建議直接請人協助。', genderNote, tags: ['緊急', '醫院'], priority: 71 }),
  withAudio({ id: 'puat-thong-kha', parentId: 'emergency', childId: 'symptoms', level: 'sentence', chinese: '我肚子痛', thai: 'ปวดท้องค่ะ', romanization: 'puat thong kha', zhuyinHint: 'ㄅㄨㄚˋ ㄊㄛㄥˋ ㄎㄚ', usage: '水土不服、腸胃不舒服時可先表達症狀。', genderNote, tags: ['緊急', '症狀'], priority: 72 }),
  withAudio({ id: 'phae-kha', parentId: 'emergency', childId: 'symptoms', level: 'sentence', chinese: '我過敏', thai: 'แพ้ค่ะ', romanization: 'phae kha', zhuyinHint: 'ㄆㄟˋ ㄎㄚ', usage: '食物、藥物、皮膚過敏時先講這句，再補充過敏來源。', genderNote, tags: ['緊急', '過敏'], priority: 73 }),
  withAudio({ id: 'long-thang-kha', parentId: 'emergency', childId: 'lost', level: 'sentence', chinese: '我迷路了', thai: 'หลงทางค่ะ', romanization: 'long thang kha', zhuyinHint: 'ㄌㄛㄥˇ ㄊㄤ ㄎㄚ', usage: '迷路時可搭配飯店地址或地圖使用。', genderNote, tags: ['緊急', '迷路'], priority: 74 }),
  withAudio({ id: 'chuai-tho-hai-noi-dai-mai-kha', parentId: 'emergency', childId: 'contact', level: 'sentence', chinese: '可以幫我打電話嗎', thai: 'ช่วยโทรให้หน่อยได้ไหมคะ', romanization: 'chuai tho hai noi dai mai kha', zhuyinHint: 'ㄔㄨㄞˋ ㄊㄛ ㄏㄞˋ ㄋㄛㄧˇ ㄉㄞˋ ㄇㄞˇ ㄎㄚ', usage: '需要請飯店、店員或路人協助聯絡時使用。', genderNote, tags: ['緊急', '聯絡'], priority: 75 }),
]

export function getStarterPhrases() {
  return thaiPhrases.filter((phrase) => phrase.isStarter).sort((a, b) => a.priority - b.priority)
}

export function getPhrasesByParent(parentId: string) {
  return thaiPhrases
    .filter((phrase) => phrase.parentId === parentId)
    .sort((a, b) => a.priority - b.priority)
}

export function getChildrenByParent(parentId: string) {
  return childCategories
    .filter((category) => category.parentId === parentId)
    .sort((a, b) => a.order - b.order)
}
