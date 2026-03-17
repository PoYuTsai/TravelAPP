import { defineType, defineField, defineArrayMember } from 'sanity'

export default defineType({
  name: 'homestay',
  title: '民宿頁面',
  type: 'document',
  groups: [
    { name: 'hero', title: 'Hero 區塊', default: true },
    { name: 'video', title: '形象影片' },
    { name: 'features', title: '民宿特色' },
    { name: 'rooms', title: '房型價格' },
    { name: 'gallery', title: '環境照片' },
    { name: 'location', title: '位置資訊' },
    { name: 'proof', title: '社會證明與季節活動' },
    { name: 'faq', title: '常見問題' },
    { name: 'cta', title: '底部 CTA' },
  ],
  fields: [
    // === Hero 區塊 ===
    defineField({
      name: 'heroName',
      title: '民宿英文名',
      type: 'string',
      group: 'hero',
      initialValue: 'Huen San Fang Hotel',
    }),
    defineField({
      name: 'heroTitle',
      title: '標題',
      type: 'string',
      group: 'hero',
      initialValue: '芳縣特色民宿',
    }),
    defineField({
      name: 'heroSubtitle',
      title: '副標題',
      type: 'text',
      group: 'hero',
      rows: 2,
      initialValue: '遠離觀光區的寧靜，體驗真正的泰北在地生活',
    }),
    defineField({
      name: 'heroCtaText',
      title: 'CTA 按鈕文字',
      type: 'string',
      group: 'hero',
      initialValue: 'LINE 諮詢訂房',
    }),
    defineField({
      name: 'heroCtaLink',
      title: 'CTA 連結',
      type: 'url',
      group: 'hero',
    }),
    defineField({
      name: 'heroMainImage',
      title: '主視覺圖片',
      type: 'image',
      group: 'hero',
      options: { hotspot: true },
      fields: [
        defineField({ name: 'alt', title: 'Alt 文字', type: 'string' }),
      ],
    }),

    // === 形象影片 ===
    defineField({
      name: 'videoUrl',
      title: '影片網址 (Cloudinary)',
      type: 'url',
      group: 'video',
      description: '貼上 Cloudinary 影片網址（預設會顯示內建影片）',
    }),
    defineField({
      name: 'videoPoster',
      title: '影片封面圖',
      type: 'image',
      group: 'video',
      options: { hotspot: true },
      description: '可選：影片載入前顯示的封面',
    }),
    defineField({
      name: 'videoTitle',
      title: '影片標題（SEO 用）',
      type: 'string',
      group: 'video',
    }),

    // === 民宿特色 ===
    defineField({
      name: 'features',
      title: '民宿特色',
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

    // === 房型圖卡 ===
    defineField({
      name: 'roomCards',
      title: '房型價格圖卡',
      type: 'array',
      group: 'rooms',
      description: '上傳你設計好的房型圖卡（含照片+價格）',
      of: [
        defineArrayMember({
          type: 'image',
          options: { hotspot: true },
          fields: [
            defineField({
              name: 'alt',
              title: 'Alt 文字（SEO 用）',
              type: 'string',
              description: '例如: 雙人房 NT$800/晚',
            }),
          ],
        }),
      ],
    }),

    // === 環境照片 ===
    defineField({
      name: 'gallery',
      title: '環境照片',
      type: 'array',
      group: 'gallery',
      description: '建議 6-8 張：外觀、庭院、公共空間、周邊環境等',
      of: [
        defineArrayMember({
          type: 'image',
          options: { hotspot: true },
          fields: [
            defineField({ name: 'alt', title: 'Alt 文字', type: 'string' }),
            defineField({ name: 'caption', title: '圖片說明（可選）', type: 'string' }),
          ],
        }),
      ],
    }),

    // === 位置資訊 ===
    defineField({
      name: 'locationDescription',
      title: '位置說明',
      type: 'text',
      group: 'location',
      rows: 3,
    }),
    defineField({
      name: 'locationFromChiangMai',
      title: '從清邁出發',
      type: 'string',
      group: 'location',
      description: '例如: 車程約 2.5 小時',
    }),
    defineField({
      name: 'locationGoogleMapUrl',
      title: 'Google Map 連結',
      type: 'url',
      group: 'location',
    }),
    defineField({
      name: 'socialProofTitle',
      title: '社會證明標題',
      type: 'string',
      group: 'proof',
      initialValue: '為什麼選擇我們',
    }),
    defineField({
      name: 'socialProofSubtitle',
      title: '社會證明副標',
      type: 'string',
      group: 'proof',
      initialValue: '12 年在地經營',
    }),
    defineField({
      name: 'socialProofStats',
      title: '社會證明數據',
      type: 'array',
      group: 'proof',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({ name: 'value', title: '數值', type: 'string' }),
            defineField({ name: 'label', title: '標籤', type: 'string' }),
            defineField({ name: 'link', title: '連結（可選）', type: 'url' }),
            defineField({ name: 'showStars', title: '顯示星星', type: 'boolean', initialValue: false }),
          ],
          preview: {
            select: { title: 'value', subtitle: 'label' },
          },
        }),
      ],
    }),
    defineField({
      name: 'seasonalActivitiesTitle',
      title: '季節活動標題',
      type: 'string',
      group: 'proof',
      initialValue: '季節限定活動',
    }),
    defineField({
      name: 'seasonalActivities',
      title: '季節活動',
      type: 'array',
      group: 'proof',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({ name: 'icon', title: 'Icon (emoji)', type: 'string' }),
            defineField({ name: 'title', title: '標題', type: 'string' }),
            defineField({ name: 'description', title: '說明', type: 'string' }),
          ],
          preview: {
            select: { title: 'title', subtitle: 'description' },
          },
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
    defineField({
      name: 'bottomCtaTitle',
      title: '底部 CTA 標題',
      type: 'string',
      group: 'cta',
      initialValue: '不只是住宿，是在地家庭的款待',
    }),
    defineField({
      name: 'bottomCtaDescription',
      title: '底部 CTA 描述',
      type: 'text',
      group: 'cta',
      rows: 2,
      initialValue: '12 年來接待過上千組旅客，我們知道什麼是真正的泰北體驗',
    }),
    defineField({
      name: 'bottomCtaHelperText',
      title: '底部 CTA 補充文字',
      type: 'string',
      group: 'cta',
      initialValue: '告訴我們你的旅行日期，我們幫你安排從清邁到芳縣的一切',
    }),
    defineField({
      name: 'bottomCtaText',
      title: '底部 CTA 按鈕文字',
      type: 'string',
      group: 'cta',
      initialValue: 'LINE 詢問房況與接送',
    }),

    // === 棄用欄位（隱藏，僅為了避免 Unknown fields 警告）===
    defineField({
      name: 'videoShow',
      type: 'boolean',
      hidden: true,
    }),
    defineField({
      name: 'videoYoutubeId',
      type: 'string',
      hidden: true,
    }),
    defineField({
      name: 'seoTitle',
      type: 'string',
      hidden: true,
    }),
    defineField({
      name: 'seoDescription',
      type: 'text',
      hidden: true,
    }),
  ],
  preview: {
    prepare() {
      return { title: '民宿頁面' }
    },
  },
})
