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
    { name: 'faq', title: '常見問題' },
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
      name: 'videoShow',
      title: '顯示影片',
      type: 'boolean',
      group: 'video',
      initialValue: false,
    }),
    defineField({
      name: 'videoUrl',
      title: '影片網址 (Cloudinary)',
      type: 'url',
      group: 'video',
      description: '貼上 Cloudinary 影片網址',
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
  ],
  preview: {
    prepare() {
      return { title: '民宿頁面' }
    },
  },
})
