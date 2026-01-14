import { defineType, defineField, defineArrayMember } from 'sanity'

export default defineType({
  name: 'carCharter',
  title: '包車服務頁面',
  type: 'document',
  groups: [
    { name: 'hero', title: 'Hero 區塊', default: true },
    { name: 'video', title: '形象影片' },
    { name: 'features', title: '服務特色' },
    { name: 'pricing', title: '價格表' },
    { name: 'process', title: '預訂流程' },
    { name: 'gallery', title: '車輛照片' },
    { name: 'faq', title: '常見問題' },
    { name: 'seo', title: 'SEO 設定' },
  ],
  fields: [
    // === Hero 區塊 ===
    defineField({
      name: 'heroTitle',
      title: '標題',
      type: 'string',
      group: 'hero',
      initialValue: '清邁親子包車服務',
    }),
    defineField({
      name: 'heroSubtitle',
      title: '副標題',
      type: 'text',
      group: 'hero',
      rows: 2,
      initialValue: '專屬司機 + 中文導遊，讓您的清邁之旅輕鬆又安心',
    }),
    defineField({
      name: 'heroCtaText',
      title: 'CTA 按鈕文字',
      type: 'string',
      group: 'hero',
      initialValue: 'LINE 免費諮詢',
    }),
    defineField({
      name: 'heroCtaLink',
      title: 'CTA 連結',
      type: 'url',
      group: 'hero',
    }),

    // === 形象影片 ===
    defineField({
      name: 'videoShow',
      title: '顯示影片',
      type: 'boolean',
      group: 'video',
      initialValue: false,
    }),
    defineField({
      name: 'videoYoutubeId',
      title: 'YouTube 影片 ID',
      type: 'string',
      group: 'video',
      description: '例如: dQw4w9WgXcQ（從 YouTube 網址取得）',
    }),
    defineField({
      name: 'videoTitle',
      title: '影片標題（SEO 用）',
      type: 'string',
      group: 'video',
    }),

    // === 服務特色 ===
    defineField({
      name: 'features',
      title: '服務特色',
      type: 'array',
      group: 'features',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({ name: 'icon', title: 'Icon (emoji)', type: 'string' }),
            defineField({ name: 'title', title: '標題', type: 'string' }),
            defineField({ name: 'description', title: '說明', type: 'text', rows: 2 }),
          ],
          preview: {
            select: { title: 'title', subtitle: 'icon' },
            prepare: ({ title, subtitle }) => ({
              title,
              subtitle,
              media: () => subtitle,
            }),
          },
        }),
      ],
    }),

    // === 價格表 ===
    defineField({
      name: 'pricingSectionTitle',
      title: '區塊標題',
      type: 'string',
      group: 'pricing',
      initialValue: '服務價格',
    }),
    defineField({
      name: 'pricingVehicleTypes',
      title: '車型價格',
      type: 'array',
      group: 'pricing',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({ name: 'name', title: '車型名稱', type: 'string' }),
            defineField({ name: 'subtitle', title: '副標題', type: 'string', description: '例如: 適合 1-3 人' }),
            defineField({ name: 'icon', title: 'Icon (emoji)', type: 'string' }),
            defineField({ name: 'maxPassengers', title: '最多乘客數', type: 'number' }),
            defineField({
              name: 'routes',
              title: '路線價格',
              type: 'array',
              of: [
                defineArrayMember({
                  type: 'object',
                  fields: [
                    defineField({ name: 'destination', title: '目的地', type: 'string' }),
                    defineField({ name: 'price', title: '價格', type: 'string' }),
                  ],
                  preview: {
                    select: { title: 'destination', subtitle: 'price' },
                  },
                }),
              ],
            }),
            defineField({
              name: 'airportTransfer',
              title: '接送機',
              type: 'object',
              fields: [
                defineField({ name: 'label', title: '標籤', type: 'string', initialValue: '接送機' }),
                defineField({ name: 'price', title: '價格', type: 'string' }),
              ],
            }),
          ],
          preview: {
            select: { title: 'name', subtitle: 'subtitle', icon: 'icon' },
            prepare: ({ title, subtitle, icon }) => ({
              title: `${icon || ''} ${title}`,
              subtitle,
            }),
          },
        }),
      ],
    }),
    defineField({
      name: 'pricingFootnotes',
      title: '備註',
      type: 'array',
      group: 'pricing',
      of: [{ type: 'string' }],
      description: '價格表下方的備註說明',
    }),

    // === 預訂流程 ===
    defineField({
      name: 'process',
      title: '預訂流程',
      type: 'array',
      group: 'process',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({ name: 'step', title: '步驟編號', type: 'number' }),
            defineField({ name: 'title', title: '標題', type: 'string' }),
            defineField({ name: 'description', title: '說明', type: 'text', rows: 2 }),
          ],
          preview: {
            select: { title: 'title', step: 'step' },
            prepare: ({ title, step }) => ({
              title: `${step}. ${title}`,
            }),
          },
        }),
      ],
    }),

    // === 車輛照片 ===
    defineField({
      name: 'gallery',
      title: '車輛照片',
      type: 'array',
      group: 'gallery',
      of: [
        defineArrayMember({
          type: 'image',
          options: { hotspot: true },
          fields: [
            defineField({ name: 'alt', title: 'Alt 文字', type: 'string' }),
            defineField({ name: 'caption', title: '圖片說明', type: 'string' }),
          ],
        }),
      ],
    }),

    // === FAQ ===
    defineField({
      name: 'faq',
      title: '常見問題',
      type: 'array',
      group: 'faq',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({ name: 'question', title: '問題', type: 'string' }),
            defineField({ name: 'answer', title: '答案', type: 'text', rows: 3 }),
          ],
          preview: {
            select: { title: 'question' },
          },
        }),
      ],
    }),

    // === SEO ===
    defineField({
      name: 'seoTitle',
      title: 'Meta Title',
      type: 'string',
      group: 'seo',
    }),
    defineField({
      name: 'seoDescription',
      title: 'Meta Description',
      type: 'text',
      group: 'seo',
      rows: 2,
      validation: (Rule) => Rule.max(160).warning('建議不超過 160 字'),
    }),
  ],
  preview: {
    prepare() {
      return { title: '包車服務頁面' }
    },
  },
})
