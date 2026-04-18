import { defineArrayMember, defineField, defineType } from 'sanity'

export default defineType({
  name: 'siteSettings',
  title: 'Site Settings / 全站設定',
  type: 'document',
  groups: [
    { name: 'brand', title: 'Brand / 品牌資訊', default: true },
    { name: 'social', title: 'Social / 社群連結' },
    { name: 'seo', title: 'SEO / AEO' },
    { name: 'home', title: 'Homepage / 首頁信任內容' },
  ],
  fields: [
    defineField({
      name: 'businessName',
      title: 'Business Name / 品牌名稱',
      type: 'string',
      group: 'brand',
      initialValue: '清微旅行 Chiangway Travel',
      description: '會用在全站 schema、SEO 與品牌識別上。',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Brand Description / 品牌描述',
      type: 'text',
      rows: 3,
      group: 'brand',
      description: '用於全站 LocalBusiness / Organization schema，也會影響 AI 摘要與搜尋片段。',
      validation: (Rule) => Rule.required().max(220),
    }),
    defineField({
      name: 'telephone',
      title: 'Telephone / 聯絡電話',
      type: 'string',
      group: 'brand',
      initialValue: '+66-63-790-0666',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'email',
      title: 'Email / 聯絡信箱',
      type: 'string',
      group: 'brand',
      initialValue: 'eric19921204@gmail.com',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'priceRange',
      title: 'Price Range / 價格區間',
      type: 'string',
      group: 'brand',
      initialValue: 'NT$ 3,000 - 10,000',
      description: '主要給 schema 與信任資訊使用，不是精準報價。',
    }),
    defineField({
      name: 'areaServed',
      title: 'Area Served / 服務區域',
      type: 'string',
      group: 'brand',
      initialValue: 'Chiang Mai',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'footer',
      title: 'Footer Content / 頁尾內容',
      type: 'object',
      group: 'brand',
      description: '控制網站頁尾的品牌說明、地址與聯絡電話。',
      initialValue: {
        description:
          '爸媽開的清邁親子包車。台灣爸爸 Eric × 泰國媽媽 Min，司機導遊專業分工，專為帶小孩的家庭設計，深受台灣家庭信賴。',
        addressText: '444, Wiang, Fang District, Chiang Mai 50110',
        addressUrl: 'https://share.google/p6anNFwTvi9Sc7JAt',
        taiwanPhone: '+886 987-591-322',
        taiwanPhoneLabel: '台灣',
        thailandPhone: '+66 63-790-0666',
        thailandPhoneLabel: '泰國',
      },
      fields: [
        defineField({
          name: 'description',
          title: 'Footer Description / 頁尾品牌說明',
          type: 'text',
          rows: 4,
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: 'addressText',
          title: 'Address Text / 地址文字',
          type: 'string',
        }),
        defineField({
          name: 'addressUrl',
          title: 'Address Link / 地址連結',
          type: 'url',
        }),
        defineField({
          name: 'taiwanPhone',
          title: 'Taiwan Phone / 台灣電話',
          type: 'string',
        }),
        defineField({
          name: 'taiwanPhoneLabel',
          title: 'Taiwan Phone Label / 台灣電話標籤',
          type: 'string',
          initialValue: '台灣',
        }),
        defineField({
          name: 'thailandPhone',
          title: 'Thailand Phone / 泰國電話',
          type: 'string',
        }),
        defineField({
          name: 'thailandPhoneLabel',
          title: 'Thailand Phone Label / 泰國電話標籤',
          type: 'string',
          initialValue: '泰國',
        }),
      ],
    }),
    defineField({
      name: 'authorProfile',
      title: 'Author Profile / 作者卡內容',
      type: 'object',
      group: 'brand',
      description: '文章詳頁側欄使用的品牌作者卡。',
      initialValue: {
        eyebrow: 'About Chiangway',
        imageAlt: 'Eric 與 Min，清微旅行在地家庭團隊',
        name: 'Eric & Min',
        description: '爸媽開的清邁親子包車，由台灣爸爸 Eric 與泰國媽媽 Min 經營，專為帶小孩的家庭設計。',
        serviceLabel: '服務方式',
        serviceValue: '司機 + 導遊',
        summary: '文章內容會從親子旅行、交通、景點與在地生活角度出發，幫你把清邁自由行需要的資訊先整理順。',
        primaryCtaText: 'LINE 詢問清邁行程',
        secondaryCtaText: '看行程案例',
      },
      fields: [
        defineField({
          name: 'eyebrow',
          title: 'Eyebrow / 小標',
          type: 'string',
          initialValue: 'About Chiangway',
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: 'imageAlt',
          title: 'Image Alt / 圖片替代文字',
          type: 'string',
          initialValue: 'Eric 與 Min，清微旅行在地家庭團隊',
        }),
        defineField({
          name: 'name',
          title: 'Name / 顯示名稱',
          type: 'string',
          initialValue: 'Eric & Min',
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: 'description',
          title: 'Short Description / 短描述',
          type: 'text',
          rows: 3,
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: 'serviceLabel',
          title: 'Service Label / 服務標籤',
          type: 'string',
          initialValue: '服務方式',
        }),
        defineField({
          name: 'serviceValue',
          title: 'Service Value / 服務值',
          type: 'string',
          initialValue: '司機 + 導遊',
        }),
        defineField({
          name: 'summary',
          title: 'Summary / 補充說明',
          type: 'text',
          rows: 3,
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: 'primaryCtaText',
          title: 'Primary CTA Text / 主按鈕文字',
          type: 'string',
          initialValue: 'LINE 詢問清邁行程',
        }),
        defineField({
          name: 'secondaryCtaText',
          title: 'Secondary CTA Text / 次按鈕文字',
          type: 'string',
          initialValue: '看行程案例',
        }),
      ],
    }),
    defineField({
      name: 'socialLinks',
      title: 'Social Links / 社群連結',
      type: 'object',
      group: 'social',
      fields: [
        defineField({
          name: 'line',
          title: 'LINE URL',
          type: 'url',
          initialValue: 'https://line.me/R/ti/p/@037nyuwk',
        }),
        defineField({
          name: 'facebook',
          title: 'Facebook URL',
          type: 'url',
          initialValue: 'https://www.facebook.com/profile.php?id=61569067776768',
        }),
        defineField({
          name: 'instagram',
          title: 'Instagram URL',
          type: 'url',
          initialValue: 'https://www.instagram.com/chiangway_travel',
        }),
        defineField({
          name: 'tiktok',
          title: 'TikTok URL',
          type: 'url',
          initialValue: 'https://www.tiktok.com/@chiangway_travel',
        }),
      ],
    }),
    defineField({
      name: 'aggregateRating',
      title: 'Aggregate Rating / 評價摘要',
      type: 'object',
      group: 'seo',
      description: '會用在首頁、服務頁與 schema 的信任數據。',
      fields: [
        defineField({
          name: 'ratingValue',
          title: 'Rating Value / 評分',
          type: 'number',
          initialValue: 5,
          validation: (Rule) => Rule.required().min(1).max(5),
        }),
        defineField({
          name: 'reviewCount',
          title: 'Review Count / 評價數',
          type: 'number',
          initialValue: 110,
          validation: (Rule) => Rule.required().min(1),
        }),
      ],
    }),
    defineField({
      name: 'homeFaq',
      title: 'Home FAQ / 首頁 FAQ',
      type: 'array',
      group: 'seo',
      description: '首頁 FAQ 與 FAQPage schema 會直接吃這裡的內容。',
      validation: (Rule) => Rule.min(1),
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'question',
              title: 'Question / 問題',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'answer',
              title: 'Answer / 回答',
              type: 'text',
              rows: 3,
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: { title: 'question', subtitle: 'answer' },
          },
        }),
      ],
    }),
    defineField({
      name: 'homeTestimonials',
      title: 'Home Testimonials / 首頁評論',
      type: 'array',
      group: 'home',
      description: '首頁信任區塊顯示的評論內容。建議挑 4-6 則最能代表品牌的回饋。',
      validation: (Rule) => Rule.min(1),
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'name',
              title: 'Name / 顯示名稱',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'location',
              title: 'Location / 地點',
              type: 'string',
            }),
            defineField({
              name: 'kids',
              title: 'Family Info / 旅伴資訊',
              type: 'string',
              description: '例如：2 大 2 小、帶長輩同行。',
            }),
            defineField({
              name: 'content',
              title: 'Content / 評論全文',
              type: 'text',
              rows: 5,
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'highlight',
              title: 'Highlight / 重點摘要',
              type: 'string',
              description: '會顯示在卡片的重點句。',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'source',
              title: 'Source / 來源',
              type: 'string',
              options: {
                list: [
                  { title: 'Google', value: 'google' },
                  { title: 'Facebook', value: 'facebook' },
                ],
                layout: 'radio',
              },
              initialValue: 'google',
            }),
          ],
          preview: {
            select: {
              title: 'name',
              subtitle: 'highlight',
              source: 'source',
            },
            prepare: ({ title, subtitle, source }) => ({
              title,
              subtitle: `${source === 'facebook' ? 'Facebook' : 'Google'} | ${subtitle || '未填重點摘要'}`,
            }),
          },
        }),
      ],
    }),
    defineField({
      name: 'trustSection',
      title: 'Trust Section / 信任卡區塊',
      type: 'object',
      group: 'home',
      description: '首頁與 /tours 會共用這組信任卡內容，適合放最關鍵的品牌證據。',
      initialValue: {
        eyebrow: '先看可被驗證的信任感',
        title: '不用先相信廣告文案',
        description: '先看公開評價、真實家庭出發紀錄，以及我們是怎麼把這趟旅程顧好的。',
        cards: [
          {
            metric: 'families',
            title: '真實行程案例',
            description: '不是展示漂亮文案而已，而是真的有家庭實際出發、留下旅程紀錄。',
            href: '/tours',
            external: false,
          },
          {
            metric: 'reviews',
            title: 'Google 公開評價',
            description: '先看公開平台上的真實回饋，再決定這樣的服務方式適不適合你們家。',
            href: 'https://maps.app.goo.gl/8MbRV4PPBggwj2pF6',
            external: true,
          },
          {
            metric: 'brand',
            title: '爸媽經營，更懂帶小孩',
            description: '不是車隊或旅行社，而是自己也帶小孩的爸媽親自經營的包車服務。',
            href: '/services/car-charter',
            external: false,
            valueOverride: 'Eric + Min',
          },
        ],
      },
      fields: [
        defineField({
          name: 'eyebrow',
          title: 'Eyebrow / 小標',
          type: 'string',
          initialValue: '先看可被驗證的信任感',
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: 'title',
          title: 'Title / 標題',
          type: 'string',
          initialValue: '不用先相信廣告文案',
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: 'description',
          title: 'Description / 說明',
          type: 'text',
          rows: 3,
          initialValue: '先看公開評價、真實家庭出發紀錄，以及我們是怎麼把這趟旅程顧好的。',
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: 'cards',
          title: 'Trust Cards / 信任卡',
          type: 'array',
          validation: (Rule) => Rule.min(1),
          of: [
            defineArrayMember({
              type: 'object',
              fields: [
                defineField({
                  name: 'metric',
                  title: 'Metric / 顯示值類型',
                  type: 'string',
                  options: {
                    list: [
                      { title: 'Families Count / 家庭數', value: 'families' },
                      { title: 'Review Summary / 評價摘要', value: 'reviews' },
                      { title: 'Brand Label / 品牌標籤', value: 'brand' },
                    ],
                    layout: 'radio',
                  },
                  validation: (Rule) => Rule.required(),
                }),
                defineField({
                  name: 'title',
                  title: 'Card Title / 卡片標題',
                  type: 'string',
                  validation: (Rule) => Rule.required(),
                }),
                defineField({
                  name: 'description',
                  title: 'Card Description / 卡片說明',
                  type: 'text',
                  rows: 3,
                  validation: (Rule) => Rule.required(),
                }),
                defineField({
                  name: 'href',
                  title: 'Card Link / 卡片連結',
                  type: 'string',
                  description: '內部頁面請用相對路徑，例如 `/tours`；外部請填完整網址。',
                  validation: (Rule) => Rule.required(),
                }),
                defineField({
                  name: 'external',
                  title: 'Open External / 外部開新分頁',
                  type: 'boolean',
                  initialValue: false,
                }),
                defineField({
                  name: 'valueOverride',
                  title: 'Value Override / 自訂顯示值',
                  type: 'string',
                  description: '只有 Brand Label 類型通常會用到，例如 `Eric + Min`。',
                }),
              ],
              preview: {
                select: {
                  title: 'title',
                  metric: 'metric',
                },
                prepare: ({ title, metric }) => ({
                  title: title || '未命名信任卡',
                  subtitle:
                    metric === 'families'
                      ? 'Families Count / 家庭數'
                      : metric === 'reviews'
                        ? 'Review Summary / 評價摘要'
                        : 'Brand Label / 品牌標籤',
                }),
              },
            }),
          ],
        }),
      ],
    }),
  ],
  preview: {
    prepare() {
      return {
        title: 'Site Settings / 全站設定',
      }
    },
  },
})
