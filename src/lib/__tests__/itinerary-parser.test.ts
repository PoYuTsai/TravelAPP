// src/lib/__tests__/itinerary-parser.test.ts
import { describe, it, expect } from 'vitest'
import {
  parseItineraryText,
  parseBasicInfoText,
  parseQuotationText,
  formatToLineText,
  sanityToLineText,
} from '../itinerary-parser'

describe('parseBasicInfoText', () => {
  it('解析客戶姓名', () => {
    const result = parseBasicInfoText('客戶姓名: 巧玲(KAI &MINNIE 媽)')
    expect(result.clientName).toBe('巧玲(KAI &MINNIE 媽)')
  })

  it('解析客戶: 格式', () => {
    const result = parseBasicInfoText('客戶: 王小明')
    expect(result.clientName).toBe('王小明')
  })

  it('解析日期範圍', () => {
    const result = parseBasicInfoText('日期: 2026/2/12~2/18')
    expect(result.startDate).toBe('2026-02-12')
    expect(result.endDate).toBe('2026-02-18')
  })

  it('解析跨月日期', () => {
    const result = parseBasicInfoText('日期: 2026/1/28~2/3')
    expect(result.startDate).toBe('2026-01-28')
    expect(result.endDate).toBe('2026-02-03')
  })

  it('解析人數: 4大2小', () => {
    const result = parseBasicInfoText('人數: 4大2小')
    expect(result.adults).toBe(4)
    expect(result.children).toBe(2)
    expect(result.totalPeople).toBe(6)
  })

  it('解析人數帶小孩年齡: 4大2小 (5歲、3歲)', () => {
    const result = parseBasicInfoText('人數: 4大2小 (5歲、3歲)')
    expect(result.adults).toBe(4)
    expect(result.children).toBe(2)
    expect(result.childrenAges).toBe('5歲、3歲')
  })

  it('解析成人小朋友格式', () => {
    const result = parseBasicInfoText('成人3 (1長者) 小朋友2 (國中生*2)')
    expect(result.adults).toBe(3)
    expect(result.children).toBe(2)
    expect(result.childrenAges).toBe('國中生*2')
  })

  it('解析總人數', () => {
    const result = parseBasicInfoText('人數: 5人')
    expect(result.totalPeople).toBe(5)
  })

  it('解析團型', () => {
    const result = parseBasicInfoText('團型: 親子團')
    expect(result.groupType).toBe('親子團')
  })

  it('解析行李說明', () => {
    const result = parseBasicInfoText('行李: 1台車大約可以放6~7顆28~30吋')
    expect(result.luggageNote).toBe('1台車大約可以放6~7顆28~30吋')
  })

  it('解析包車說明', () => {
    const result = parseBasicInfoText('包車: 1台(10人座大車)')
    expect(result.vehicleNote).toBe('1台(10人座大車)')
  })

  it('解析導遊說明', () => {
    const result = parseBasicInfoText('導遊: 中英泰導遊 1位')
    expect(result.guideNote).toBe('中英泰導遊 1位')
  })

  it('解析完整資訊', () => {
    const text = `客戶姓名: 巧玲(KAI &MINNIE 媽)
日期: 2026/2/12~2/18
人數: 5人
成人3 (1長者) 小朋友2 (國中生*2)
行李: 1台車大約可以放6~7顆28~30吋
包車: 1台(10人座大車)
導遊: 中英泰導遊 1位`

    const result = parseBasicInfoText(text)
    expect(result.clientName).toBe('巧玲(KAI &MINNIE 媽)')
    expect(result.startDate).toBe('2026-02-12')
    expect(result.endDate).toBe('2026-02-18')
    expect(result.adults).toBe(3)
    expect(result.children).toBe(2)
    expect(result.luggageNote).toBe('1台車大約可以放6~7顆28~30吋')
    expect(result.vehicleNote).toBe('1台(10人座大車)')
    expect(result.guideNote).toBe('中英泰導遊 1位')
  })
})

describe('parseItineraryText', () => {
  it('解析單日行程', () => {
    const text = `2/12 (四)
Day 1｜抵達清邁・放鬆展開旅程
・機場接機
午餐：Neng earthn jar roast pork
・泰服拍攝體驗
晚餐: 黑森林餐廳
・住宿`

    const result = parseItineraryText(text, 2026)
    expect(result.success).toBe(true)
    expect(result.days.length).toBe(1)
    expect(result.days[0].date).toBe('2026-02-12')
    expect(result.days[0].dayNumber).toBe(1)
    expect(result.days[0].title).toBe('抵達清邁・放鬆展開旅程')
    expect(result.days[0].lunch).toBe('Neng earthn jar roast pork')
    expect(result.days[0].dinner).toBe('黑森林餐廳')
  })

  it('解析多日行程', () => {
    const text = `2/12 (四)
Day 1｜抵達清邁
・機場接機
午餐：餐廳A
・住宿

2/13 (五)
Day 2｜湄康蓬村
・景點A
午餐: 餐廳B
・住宿`

    const result = parseItineraryText(text, 2026)
    expect(result.success).toBe(true)
    expect(result.days.length).toBe(2)
    expect(result.days[0].date).toBe('2026-02-12')
    expect(result.days[1].date).toBe('2026-02-13')
    expect(result.days[1].title).toBe('湄康蓬村')
  })

  it('正確分配早上/下午/晚上活動', () => {
    const text = `2/12 (四)
Day 1｜測試
・早上活動1
・早上活動2
午餐：午餐
・下午活動1
・下午活動2
晚餐: 黑森林餐廳
・夜市逛街`

    const result = parseItineraryText(text, 2026)
    expect(result.days[0].morning).toContain('早上活動1')
    expect(result.days[0].morning).toContain('早上活動2')
    expect(result.days[0].afternoon).toContain('下午活動1')
    expect(result.days[0].afternoon).toContain('下午活動2')
    // 晚上 = 夜市 + 晚餐
    expect(result.days[0].evening).toContain('夜市逛街')
    expect(result.days[0].evening).toContain('晚餐：黑森林餐廳')
  })

  it('處理沒有 Day 標題的行程', () => {
    const text = `2/12 (四)
・機場接機
午餐：餐廳`

    const result = parseItineraryText(text, 2026)
    expect(result.success).toBe(true)
    expect(result.days.length).toBe(1)
    expect(result.days[0].date).toBe('2026-02-12')
  })

  it('住宿獨立存放在 accommodation 欄位', () => {
    const text = `2/13 (五)
Day 2｜湄康蓬村一日
・Teen Tok Royal Project
・湄康蓬村
・Mae Kampong Waterfall
・村內咖啡館
・可可果園Skugga Estate
・清邁大學夜市
・住宿: Nimman Villa Hotel`

    const result = parseItineraryText(text, 2026)
    // 住宿獨立存放，不在早/午/晚欄位
    expect(result.days[0].accommodation).toBe('Nimman Villa Hotel')
    expect(result.days[0].evening).not.toContain('住宿')
    expect(result.days[0].morning).not.toContain('住宿')
    expect(result.days[0].afternoon).not.toContain('住宿')
  })

  it('沒有午餐時自動分配早午', () => {
    const text = `2/21 (六)
Day 2｜換錢・市集日
・換錢
・巫宗雄
・Nakhonping Exchange
・市集: 真心市集
・市集: 白色市集
晚餐：周六夜市
・住宿: Victoria Hotel`

    const result = parseItineraryText(text, 2026)
    // 早上應該有活動
    expect(result.days[0].morning).toBeTruthy()
    // 下午應該有活動（自動分配）
    expect(result.days[0].afternoon).toBeTruthy()
    // 住宿獨立存放
    expect(result.days[0].accommodation).toBe('Victoria Hotel')
    // 晚上不包含住宿
    expect(result.days[0].evening).not.toContain('住宿')
  })

  it('有午餐時正確分配時段', () => {
    const text = `2/23 (一)
Day 4｜茵他儂國家公園
・茵他儂國家公園主峰
・Ban Mae Klang Luang
午餐：苗族市場用餐
・參觀苗族市場
・瓦吉拉瀑布
晚餐：Baan Landai
・住宿: Mountain Resort`

    const result = parseItineraryText(text, 2026)
    // 午餐前 → 早
    expect(result.days[0].morning).toContain('茵他儂國家公園主峰')
    // 午餐後到晚餐前 → 午
    expect(result.days[0].afternoon).toContain('參觀苗族市場')
    expect(result.days[0].afternoon).toContain('瓦吉拉瀑布')
    // 住宿獨立存放
    expect(result.days[0].accommodation).toBe('Mountain Resort')
    // 晚上不包含住宿
    expect(result.days[0].evening).not.toContain('住宿')
  })
})

describe('parseQuotationText', () => {
  it('解析帶日期的報價項目', () => {
    const result = parseQuotationText('2/12 接機+市區 3200', 2026)
    expect(result.items.length).toBe(1)
    expect(result.items[0].date).toBe('2026-02-12')
    expect(result.items[0].description).toBe('接機+市區')
    expect(result.items[0].unitPrice).toBe(3200)
    expect(result.items[0].quantity).toBe(1)
  })

  it('解析乘數格式: 導遊 2500*6天', () => {
    const result = parseQuotationText('導遊 2500*6天', 2026)
    expect(result.items.length).toBe(1)
    expect(result.items[0].description).toBe('導遊')
    expect(result.items[0].unitPrice).toBe(2500)
    expect(result.items[0].quantity).toBe(6)
    expect(result.items[0].unit).toBe('天')
  })

  it('解析簡單項目: 保險 500', () => {
    const result = parseQuotationText('保險 500', 2026)
    expect(result.items.length).toBe(1)
    expect(result.items[0].description).toBe('保險')
    expect(result.items[0].unitPrice).toBe(500)
    expect(result.items[0].quantity).toBe(1)
  })

  it('解析小計', () => {
    const result = parseQuotationText('小計: 38700', 2026)
    expect(result.total).toBe(38700)
  })

  it('解析帶逗號的金額', () => {
    const result = parseQuotationText('小計: 138,700', 2026)
    expect(result.total).toBe(138700)
  })

  it('解析完整報價', () => {
    const text = `2/12 接機+市區 3200
2/13 湄康蓬 3800
2/14 湄林 3800
2/15 市區 3500
2/16 清萊 4500
2/17 湄登 3800
2/18 送機 600
導遊 2500*6天
保險 500
小計: 38700`

    const result = parseQuotationText(text, 2026)
    expect(result.items.length).toBe(9)
    expect(result.total).toBe(38700)

    // 檢查第一項
    expect(result.items[0].date).toBe('2026-02-12')
    expect(result.items[0].description).toBe('接機+市區')
    expect(result.items[0].unitPrice).toBe(3200)

    // 檢查導遊
    const guideItem = result.items.find((item) => item.description === '導遊')
    expect(guideItem).toBeDefined()
    expect(guideItem?.unitPrice).toBe(2500)
    expect(guideItem?.quantity).toBe(6)
  })
})

describe('formatToLineText', () => {
  it('格式化單日行程', () => {
    const days = [
      {
        date: '2026-02-12',
        dayNumber: 1,
        title: '抵達清邁',
        morning: '機場接機',
        afternoon: '泰服體驗',
        evening: '夜市',
        lunch: '午餐A',
        dinner: '晚餐B',
        activities: [],
        rawText: '',
      },
    ]

    const result = formatToLineText(days)
    expect(result).toContain('2/12 (四)')
    expect(result).toContain('Day 1｜抵達清邁')
    expect(result).toContain('・機場接機')
    expect(result).toContain('午餐：午餐A')
    expect(result).toContain('・泰服體驗')
    expect(result).toContain('晚餐：晚餐B')
    expect(result).toContain('・夜市')
  })
})

describe('sanityToLineText', () => {
  it('轉換 Sanity 資料為 LINE 文字', () => {
    const itinerary = {
      clientName: '王小明',
      days: [
        {
          date: '2026-02-12',
          title: '抵達清邁',
          morning: '機場接機',
          afternoon: '',
          evening: '',
          lunch: '午餐',
          dinner: '',
        },
      ],
    }

    const result = sanityToLineText(itinerary)
    // 標題行已移除，直接開始行程
    expect(result).toContain('2/12 (四)')
    expect(result).toContain('Day 1｜抵達清邁')
    expect(result).toContain('・機場接機')
    expect(result).toContain('午餐：午餐')
  })

  it('處理空行程', () => {
    const itinerary = { clientName: '測試', days: [] }
    const result = sanityToLineText(itinerary)
    expect(result).toBe('（無行程資料）')
  })
})
