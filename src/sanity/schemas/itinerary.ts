// src/sanity/schemas/itinerary.ts
import { defineType, defineField, defineArrayMember } from 'sanity'
import { QuickStartInput } from '../components/QuickStartInput'

export default defineType({
  name: 'itinerary',
  title: '行程表',
  type: 'document',
  groups: [
    { name: 'basic', title: '基本資訊', default: true },
    { name: 'days', title: '每日行程' },
    { name: 'hotels', title: '住宿安排' },
    { name: 'quotation', title: '報價明細' },
    { name: 'pricing', title: '費用說明' },
  ],
  fields: [
    // === 快速建立提示（新文件時顯示）===
    defineField({
      name: 'quickStartHint',
      title: ' ',
      type: 'string',
      group: 'basic',
      components: {
        input: QuickStartInput,
      },
    }),
    // === 基本資訊 ===
    defineField({
      name: 'clientName',
      title: '客戶名稱',
      type: 'string',
      group: 'basic',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'startDate',
      title: '出發日期',
      type: 'date',
      group: 'basic',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'endDate',
      title: '結束日期',
      type: 'date',
      group: 'basic',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'adults',
      title: '大人人數',
      type: 'number',
      group: 'basic',
      initialValue: 2,
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'children',
      title: '小孩人數',
      type: 'number',
      group: 'basic',
      initialValue: 0,
    }),
    defineField({
      name: 'childrenAges',
      title: '小孩年齡',
      type: 'string',
      group: 'basic',
      description: '例：5歲、2歲',
    }),
    defineField({
      name: 'groupType',
      title: '團型說明',
      type: 'string',
      group: 'basic',
      description: '例：親子團、長輩團、蜜月、員工旅遊',
    }),
    defineField({
      name: 'totalPeople',
      title: '總人數',
      type: 'number',
      group: 'basic',
      description: '全團總人數（大人+小孩）',
    }),
    defineField({
      name: 'luggageNote',
      title: '行李說明',
      type: 'string',
      group: 'basic',
      description: '例：1台大約可以放6~7顆28~30吋',
    }),
    defineField({
      name: 'vehicleNote',
      title: '包車說明',
      type: 'string',
      group: 'basic',
      description: '例：2台10人座大車',
    }),
    defineField({
      name: 'guideNote',
      title: '導遊說明',
      type: 'string',
      group: 'basic',
      description: '例：中英泰導遊 1位',
    }),

    // === 航班資訊 ===
    defineField({
      name: 'arrivalFlight',
      title: '接機航班',
      type: 'object',
      group: 'basic',
      fields: [
        defineField({
          name: 'preset',
          title: '常用航班',
          type: 'string',
          options: {
            list: [
              { title: '華航 CI851 (07:30-10:20)', value: 'CI851' },
              { title: '長榮 BR257 (07:25-10:25)', value: 'BR257' },
              { title: '星宇 JX751 (13:20-16:20)', value: 'JX751' },
              { title: '亞航 FD243 (18:55-21:45)', value: 'FD243' },
              { title: '其他（自訂）', value: 'custom' },
            ],
          },
        }),
        defineField({
          name: 'custom',
          title: '自訂航班',
          type: 'string',
          description: '格式：航空公司 航班號 (起飛-抵達)',
          hidden: ({ parent }) => parent?.preset !== 'custom',
        }),
      ],
    }),
    defineField({
      name: 'departureFlight',
      title: '送機航班',
      type: 'object',
      group: 'basic',
      fields: [
        defineField({
          name: 'preset',
          title: '常用航班',
          type: 'string',
          options: {
            list: [
              { title: '華航 CI852 (11:20-16:00)', value: 'CI852' },
              { title: '長榮 BR258 (11:35-16:35)', value: 'BR258' },
              { title: '星宇 JX752 (17:20-22:10)', value: 'JX752' },
              { title: '亞航 FD242 (01:40-06:35)', value: 'FD242' },
              { title: '其他（自訂）', value: 'custom' },
            ],
          },
        }),
        defineField({
          name: 'custom',
          title: '自訂航班',
          type: 'string',
          description: '格式：航空公司 航班號 (起飛-抵達)',
          hidden: ({ parent }) => parent?.preset !== 'custom',
        }),
      ],
    }),

    // === 服務選項 ===
    defineField({
      name: 'guideService',
      title: '導遊服務',
      type: 'object',
      group: 'basic',
      fields: [
        defineField({
          name: 'required',
          title: '需要導遊',
          type: 'boolean',
          initialValue: true,
        }),
        defineField({
          name: 'quantity',
          title: '導遊人數',
          type: 'number',
          initialValue: 1,
          hidden: ({ parent }) => !parent?.required,
          validation: (Rule) => Rule.min(1),
        }),
        defineField({
          name: 'days',
          title: '導遊天數',
          type: 'number',
          hidden: ({ parent }) => !parent?.required,
          validation: (Rule) => Rule.min(1),
        }),
      ],
    }),
    defineField({
      name: 'childSeat',
      title: '兒童安全座椅',
      type: 'object',
      group: 'basic',
      fields: [
        defineField({
          name: 'required',
          title: '需要',
          type: 'boolean',
          initialValue: false,
        }),
        defineField({
          name: 'quantity',
          title: '數量（張）',
          type: 'number',
          hidden: ({ parent }) => !parent?.required,
          validation: (Rule) => Rule.min(1),
        }),
        defineField({
          name: 'days',
          title: '天數',
          type: 'number',
          hidden: ({ parent }) => !parent?.required,
          validation: (Rule) => Rule.min(1),
        }),
      ],
    }),
    defineField({
      name: 'extraVehicle',
      title: '額外雙條車（行李用）',
      type: 'object',
      group: 'basic',
      fields: [
        defineField({
          name: 'required',
          title: '需要',
          type: 'boolean',
          initialValue: false,
        }),
        defineField({
          name: 'quantity',
          title: '數量（台）',
          type: 'number',
          initialValue: 1,
          hidden: ({ parent }) => !parent?.required,
          validation: (Rule) => Rule.min(1),
        }),
        defineField({
          name: 'days',
          title: '天數',
          type: 'number',
          hidden: ({ parent }) => !parent?.required,
          validation: (Rule) => Rule.min(1),
        }),
      ],
    }),

    // === 車輛資訊 ===
    defineField({
      name: 'vehicleCount',
      title: '包車台數',
      type: 'number',
      group: 'basic',
      initialValue: 1,
      validation: (Rule) => Rule.min(1),
    }),
    defineField({
      name: 'vehicleType',
      title: '車型',
      type: 'string',
      group: 'basic',
      options: {
        list: [
          { title: '4人座小車', value: 'sedan' },
          { title: '7人座休旅車', value: 'suv' },
          { title: '10人座大車（麵包車）', value: 'van' },
          { title: '其他', value: 'custom' },
        ],
      },
      initialValue: 'van',
    }),

    // === 行程原始文字（隱藏欄位，供備份用）===
    defineField({
      name: 'rawItineraryText',
      title: '行程原始文字',
      type: 'text',
      hidden: true,
    }),

    // === 每日行程 ===
    defineField({
      name: 'days',
      title: '每日行程',
      type: 'array',
      group: 'days',
      validation: (Rule) => [
        // 錯誤檢查：日期順序和重複
        Rule.custom((days: any[] | undefined) => {
          if (!days || days.length < 2) return true

          // 檢查日期是否按順序遞增
          for (let i = 1; i < days.length; i++) {
            const prevDate = days[i - 1]?.date
            const currDate = days[i]?.date

            if (!prevDate || !currDate) continue

            if (currDate <= prevDate) {
              return `第 ${i + 1} 天的日期 (${currDate}) 必須在第 ${i} 天 (${prevDate}) 之後`
            }
          }

          // 檢查是否有重複日期
          const dates = days.map((d: any) => d?.date).filter(Boolean)
          const uniqueDates = new Set(dates)
          if (dates.length !== uniqueDates.size) {
            return '每日行程的日期不能重複'
          }

          return true
        }),
        // 警告檢查：與出發/結束日期交叉比對
        Rule.custom((days, context) => {
          if (!days || days.length === 0) return true

          const parent = context.parent as { startDate?: string; endDate?: string }
          const startDate = parent?.startDate
          const endDate = parent?.endDate

          if (!startDate || !endDate) return true

          const dayDates = days.map((d: any) => d?.date).filter(Boolean).sort()
          const firstDayDate = dayDates[0]
          const lastDayDate = dayDates[dayDates.length - 1]

          const warnings: string[] = []

          // 檢查第一天是否與出發日期一致
          if (firstDayDate && firstDayDate !== startDate) {
            warnings.push(`行程第一天 (${firstDayDate}) 與出發日期 (${startDate}) 不一致`)
          }

          // 檢查最後一天是否與結束日期一致
          if (lastDayDate && lastDayDate !== endDate) {
            warnings.push(`行程最後一天 (${lastDayDate}) 與結束日期 (${endDate}) 不一致`)
          }

          // 計算應有天數
          const start = new Date(startDate)
          const end = new Date(endDate)
          const expectedDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

          if (days.length !== expectedDays) {
            warnings.push(`行程共 ${days.length} 天，但日期範圍應為 ${expectedDays} 天`)
          }

          if (warnings.length > 0) {
            return `⚠️ ${warnings.join('；')}`
          }

          return true
        }).warning(),
      ],
      of: [
        defineArrayMember({
          type: 'object',
          name: 'dayItem',
          title: '單日行程',
          fields: [
            defineField({
              name: 'date',
              title: '日期',
              type: 'date',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'title',
              title: '當日主題',
              type: 'string',
              description: '例：大象保育園・親子體驗日',
              validation: (Rule) => Rule.required(),
            }),
            // Excel 格式：早/午/晚 時段
            defineField({
              name: 'morning',
              title: '早（上午行程）⬜ EXCEL用',
              type: 'text',
              rows: 3,
              description: '顯示在 Excel 的「早」欄位，可多行',
            }),
            defineField({
              name: 'afternoon',
              title: '午（下午行程）⬜ EXCEL用',
              type: 'text',
              rows: 3,
              description: '顯示在 Excel 的「午」欄位，可多行',
            }),
            defineField({
              name: 'evening',
              title: '晚（晚上行程）⬜ EXCEL用',
              type: 'text',
              rows: 3,
              description: '顯示在 Excel 的「晚」欄位，可多行',
            }),
            // 保留舊欄位供 PDF 使用
            defineField({
              name: 'activities',
              title: '詳細活動列表（PDF用）',
              type: 'array',
              of: [
                defineArrayMember({
                  type: 'object',
                  name: 'activity',
                  fields: [
                    defineField({
                      name: 'time',
                      title: '時間',
                      type: 'string',
                      description: '例：09:00',
                    }),
                    defineField({
                      name: 'content',
                      title: '內容',
                      type: 'string',
                      validation: (Rule) => Rule.required(),
                    }),
                  ],
                  preview: {
                    select: { time: 'time', content: 'content' },
                    prepare: ({ time, content }) => ({
                      title: time ? `${time} ${content}` : content,
                    }),
                  },
                }),
              ],
            }),
            defineField({
              name: 'lunch',
              title: '午餐',
              type: 'string',
            }),
            defineField({
              name: 'dinner',
              title: '晚餐',
              type: 'string',
            }),
            defineField({
              name: 'accommodation',
              title: '住宿（單日）',
              type: 'string',
              description: '單日住宿，如需跨天請用「住宿安排」tab',
            }),
            // 每日費用
            defineField({
              name: 'carPrice',
              title: '車費（台幣）',
              type: 'number',
              description: '當日包車費用',
            }),
            defineField({
              name: 'guidePrice',
              title: '導遊費（台幣）',
              type: 'number',
              description: '當日導遊費用',
            }),
          ],
          preview: {
            select: { date: 'date', title: 'title', carPrice: 'carPrice', guidePrice: 'guidePrice' },
            prepare: ({ date, title, carPrice, guidePrice }) => {
              const total = (carPrice || 0) + (guidePrice || 0)
              return {
                title: title,
                subtitle: total > 0 ? `${date} | NT$${total.toLocaleString()}` : date,
              }
            },
          },
        }),
      ],
    }),

    // === 住宿安排（支援多飯店跨天）===
    defineField({
      name: 'hotels',
      title: '住宿安排',
      type: 'array',
      group: 'hotels',
      description: '可新增多個飯店，支援不同人住不同飯店、跨多天',
      validation: (Rule) => [
        // 錯誤檢查：日期邏輯
        Rule.custom((hotels, context) => {
          if (!hotels || hotels.length === 0) return true

          const parent = context.parent as { startDate?: string; endDate?: string }
          const itineraryStart = parent?.startDate
          const itineraryEnd = parent?.endDate

          for (let i = 0; i < hotels.length; i++) {
            const hotel = hotels[i] as { hotelName?: string; startDate?: string; endDate?: string }
            const name = hotel.hotelName || `第 ${i + 1} 個飯店`

            // 檢查入住日 < 退房日
            if (hotel.startDate && hotel.endDate && hotel.startDate >= hotel.endDate) {
              return `${name}：入住日期必須早於退房日期`
            }

            // 檢查入住日在行程範圍內
            if (itineraryStart && hotel.startDate && hotel.startDate < itineraryStart) {
              return `${name}：入住日期 (${hotel.startDate}) 早於行程出發日 (${itineraryStart})`
            }

            // 檢查退房日不超過行程結束後太多天（允許結束日+1天退房）
            if (itineraryEnd && hotel.endDate) {
              const endDate = new Date(itineraryEnd)
              endDate.setDate(endDate.getDate() + 1)
              const hotelEnd = new Date(hotel.endDate)
              if (hotelEnd > endDate) {
                return `${name}：退房日期 (${hotel.endDate}) 超過行程結束日太多`
              }
            }
          }
          return true
        }),
        // 警告檢查：同組飯店日期連續性
        Rule.custom((hotels) => {
          if (!hotels || hotels.length < 2) return true

          type Hotel = { hotelName?: string; startDate?: string; endDate?: string; guests?: string }
          const hotelList = hotels as Hotel[]

          // 按 guests 分組
          const groups: Record<string, Hotel[]> = {}
          hotelList.forEach((h) => {
            const group = h.guests || '未分組'
            if (!groups[group]) groups[group] = []
            groups[group].push(h)
          })

          // 檢查每組的日期連續性
          for (const [groupName, groupHotels] of Object.entries(groups)) {
            if (groupHotels.length < 2) continue

            // 按開始日期排序
            const sorted = [...groupHotels].sort((a, b) =>
              (a.startDate || '').localeCompare(b.startDate || '')
            )

            for (let i = 1; i < sorted.length; i++) {
              const prev = sorted[i - 1]
              const curr = sorted[i]
              if (prev.endDate && curr.startDate && prev.endDate !== curr.startDate) {
                return `⚠️ ${groupName}：${prev.hotelName} 退房 ${prev.endDate}，但 ${curr.hotelName} 入住 ${curr.startDate}，日期不連續`
              }
            }
          }
          return true
        }).warning(),
      ],
      of: [
        defineArrayMember({
          type: 'object',
          name: 'hotelBooking',
          title: '飯店預訂',
          fields: [
            defineField({
              name: 'hotelName',
              title: '飯店名稱',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'startDate',
              title: '入住日期 ⬜ EXCEL用',
              type: 'date',
              description: 'Excel 色塊從這天開始',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'endDate',
              title: '退房日期 ⬜ EXCEL用',
              type: 'date',
              description: 'Excel 色塊到退房前一天結束（例：退房 2/23，色塊到 2/22）',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'guests',
              title: '入住旅客 ⬜ EXCEL分組用',
              type: 'string',
              description: '同一組的飯店會顯示在 Excel 同一行（例：A組、B組、全團）',
              initialValue: '全團',
            }),
            defineField({
              name: 'note',
              title: '備註 ⬜ EXCEL用',
              type: 'string',
              description: '會顯示在 Excel 飯店名稱下方（例：不同房型、含早餐）',
            }),
            defineField({
              name: 'color',
              title: '標示顏色 ⬜ EXCEL用',
              type: 'string',
              description: 'Excel 飯店色塊的背景顏色',
              options: {
                list: [
                  { title: '黃色', value: 'yellow' },
                  { title: '綠色', value: 'green' },
                  { title: '藍色', value: 'blue' },
                  { title: '橘色', value: 'orange' },
                  { title: '粉色', value: 'pink' },
                  { title: '紫色', value: 'purple' },
                  { title: '灰色', value: 'gray' },
                ],
              },
              initialValue: 'yellow',
            }),
          ],
          preview: {
            select: {
              hotelName: 'hotelName',
              startDate: 'startDate',
              endDate: 'endDate',
              guests: 'guests',
              color: 'color',
            },
            prepare: ({ hotelName, startDate, endDate, guests, color }) => {
              // 計算住幾晚
              let nights = ''
              if (startDate && endDate) {
                const start = new Date(startDate)
                const end = new Date(endDate)
                const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
                if (diff > 0) nights = `${diff}晚`
              }

              // 顏色 emoji 對應
              const colorEmoji: Record<string, string> = {
                yellow: '🟡',
                green: '🟢',
                blue: '🔵',
                orange: '🟠',
                pink: '🩷',
                purple: '🟣',
                gray: '⚪',
              }
              const emoji = colorEmoji[color || 'yellow'] || '🟡'

              return {
                title: `${emoji} ${hotelName || '未命名飯店'}`,
                subtitle: `${startDate || '?'} ~ ${endDate || '?'}${nights ? ` (${nights})` : ''}${guests ? ` | ${guests}` : ''}`,
              }
            },
          },
        }),
      ],
    }),

    // === 報價明細 ===
    defineField({
      name: 'quotationItems',
      title: '報價項目',
      type: 'array',
      group: 'quotation',
      description: '每日包車費用、導遊費、保險等',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'quotationItem',
          title: '報價項目',
          fields: [
            defineField({
              name: 'date',
              title: '日期',
              type: 'date',
              description: '若為多日項目可不填',
            }),
            defineField({
              name: 'description',
              title: '項目說明',
              type: 'string',
              validation: (Rule) => Rule.required(),
              description: '例：接機旅遊、杭東一日、專業導遊',
            }),
            defineField({
              name: 'unitPrice',
              title: '單價',
              type: 'number',
              validation: (Rule) => Rule.required().min(0),
            }),
            defineField({
              name: 'quantity',
              title: '數量',
              type: 'number',
              initialValue: 1,
              validation: (Rule) => Rule.required().min(1),
            }),
            defineField({
              name: 'unit',
              title: '單位',
              type: 'string',
              initialValue: '台',
              description: '例：台、日、位',
            }),
            defineField({
              name: 'subtotal',
              title: '小計',
              type: 'number',
              description: '自動計算：單價 × 數量',
              readOnly: true,
            }),
          ],
          preview: {
            select: {
              date: 'date',
              description: 'description',
              unitPrice: 'unitPrice',
              quantity: 'quantity',
              unit: 'unit',
            },
            prepare: ({ date, description, unitPrice, quantity, unit }) => {
              const subtotal = (unitPrice || 0) * (quantity || 1)
              const dateStr = date ? date.substring(5).replace('-', '/') : ''
              return {
                title: dateStr ? `${dateStr} ${description}` : description,
                subtitle: `${unitPrice?.toLocaleString() || 0} × ${quantity || 1}${unit || ''} = NT$${subtotal.toLocaleString()}`,
              }
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'quotationTotal',
      title: '報價總計',
      type: 'number',
      group: 'quotation',
      description: '自動從報價項目加總',
      validation: (Rule) =>
        Rule.custom((total, context) => {
          const parent = context.parent as { quotationItems?: Array<{ unitPrice?: number; quantity?: number }> }
          if (!parent?.quotationItems) return true

          const calculated = parent.quotationItems.reduce((sum, item) => {
            return sum + (item.unitPrice || 0) * (item.quantity || 1)
          }, 0)

          if (calculated > 0 && total && total !== calculated) {
            return `提示：報價項目加總為 NT$${calculated.toLocaleString()}，與此欄位不同`
          }
          return true
        }).warning(),
    }),
    defineField({
      name: 'quotationNote',
      title: '報價備註',
      type: 'text',
      group: 'quotation',
      rows: 4,
      description: '例：包含油費、停車費、過路費；用車時間10小時，超時200/hr',
    }),
    defineField({
      name: 'serviceDescription',
      title: '服務說明',
      type: 'text',
      group: 'quotation',
      rows: 6,
      description: '導遊服務內容說明',
      initialValue: `導遊會全程照顧大家，包含景點文化導覽介紹、道地餐廳推薦點菜
我們也會全程在群組線上協助，幫忙代訂餐廳，協助一些意外狀況`,
    }),
    defineField({
      name: 'expenseManagement',
      title: '費用管理說明',
      type: 'text',
      group: 'quotation',
      rows: 5,
      description: '門票、餐費如何處理',
      initialValue: `門票費用跟餐費可以根據預算給導遊處理
例如: 第一天換錢後先給導遊20000泰銖，交代導遊用餐口味的偏好限制
(如:不吃海鮮，牛肉，菜色不要太辣等等)
每一筆都會請她記錄，多退少補，這樣後續大家算錢會比較簡單跟清楚`,
    }),
    defineField({
      name: 'travelRemarks',
      title: '旅遊備註',
      type: 'text',
      group: 'quotation',
      rows: 8,
      description: '給客人的注意事項（匯率、入境規定等）',
      initialValue: `備註:
1.個人花費跟按摩費視個人預算看攜帶多少
(泰國入境的規定是每人至少攜帶20000的等值泰銖，雖然不一定會被抽查，供參考)
2.清邁最好的巫宗雄匯率: 截至2025/12/29最新:
泰銖:台幣=1:0.98
3.入境要填TDAC (建議出國3天前就先填好，沒填一定會被海關擋下來，要求去旁邊的機器填完才能重排，比較花時間)`,
    }),

    // === 費用說明 ===
    defineField({
      name: 'totalPrice',
      title: '總費用（台幣）',
      type: 'number',
      group: 'pricing',
      description: '會自動從每日費用計算，也可手動覆蓋',
      validation: (Rule) =>
        Rule.custom((totalPrice, context) => {
          const parent = context.parent as { days?: Array<{ carPrice?: number; guidePrice?: number }> }
          if (!parent?.days) return true

          const calculated = parent.days.reduce((sum, day) => {
            return sum + (day.carPrice || 0) + (day.guidePrice || 0)
          }, 0)

          if (calculated > 0 && totalPrice && totalPrice !== calculated) {
            return `提示：每日費用加總為 NT$${calculated.toLocaleString()}，與此欄位不同`
          }
          return true
        }).warning(),
    }),
    defineField({
      name: 'priceIncludes',
      title: '費用包含',
      type: 'text',
      group: 'pricing',
      rows: 5,
      description: '每行一項，例：\n- 7人座包車（含油、過路費）\n- 中文導遊服務',
    }),
    defineField({
      name: 'priceExcludes',
      title: '費用不包含',
      type: 'text',
      group: 'pricing',
      rows: 5,
      description: '每行一項，例：\n- 機票\n- 個人消費',
    }),
  ],
  preview: {
    select: {
      clientName: 'clientName',
      startDate: 'startDate',
      endDate: 'endDate',
      adults: 'adults',
      children: 'children',
      days: 'days',
    },
    prepare: ({ clientName, startDate, endDate, adults, children, days }) => {
      // 計算天數和夜數
      let daysNights = ''
      if (startDate && endDate) {
        const start = new Date(startDate)
        const end = new Date(endDate)
        const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
        const nights = totalDays - 1
        if (totalDays > 0) daysNights = `${totalDays}天${nights}夜`
      }

      // 計算總費用
      let totalCost = 0
      if (days && Array.isArray(days)) {
        days.forEach((day: any) => {
          totalCost += (day.carPrice || 0) + (day.guidePrice || 0)
        })
      }
      const costStr = totalCost > 0 ? ` | NT$${totalCost.toLocaleString()}` : ''

      return {
        title: clientName || '未命名行程',
        subtitle: `${daysNights || '?天?夜'} | ${adults || 0}大${children || 0}小${costStr}`,
      }
    },
  },
  orderings: [
    {
      title: '出發日期（新到舊）',
      name: 'startDateDesc',
      by: [{ field: 'startDate', direction: 'desc' }],
    },
  ],
})
