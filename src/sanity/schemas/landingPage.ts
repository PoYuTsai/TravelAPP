import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'landingPage',
  title: '首頁設定',
  type: 'document',
  groups: [
    { name: 'hero', title: 'Hero 區塊', default: true },
    { name: 'whoWeAre', title: '關於我們' },
    { name: 'articles', title: '精選文章' },
    { name: 'cta', title: 'CTA 區塊' },
    { name: 'seo', title: 'SEO 設定' },
  ],
  fields: [
    // === Hero 區塊 ===
    defineField({
      name: 'heroBackgroundImage',
      title: '背景圖片',
      type: 'image',
      group: 'hero',
      options: { hotspot: true },
      description: '建議尺寸：1920x1080，會自動裁切適應螢幕',
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt 文字',
          type: 'string',
        }),
      ],
    }),
    defineField({
      name: 'heroTitle',
      title: '主標題',
      type: 'string',
      group: 'hero',
      initialValue: '清邁親子自由行，交給在地家庭',
    }),
    defineField({
      name: 'heroSubtitle',
      title: '副標題',
      type: 'string',
      group: 'hero',
      initialValue: '專為爸媽設計的包車旅程',
    }),
    defineField({
      name: 'heroDescription',
      title: '說明文字（可選）',
      type: 'text',
      group: 'hero',
      rows: 2,
    }),
    defineField({
      name: 'heroPrimaryCta',
      title: '主要按鈕',
      type: 'object',
      group: 'hero',
      fields: [
        defineField({ name: 'text', title: '按鈕文字', type: 'string', initialValue: 'LINE 聊聊' }),
        defineField({ name: 'link', title: '連結', type: 'url', initialValue: 'https://line.me/R/ti/p/@037nyuwk' }),
      ],
    }),
    defineField({
      name: 'heroSecondaryCta',
      title: '次要按鈕',
      type: 'object',
      group: 'hero',
      fields: [
        defineField({ name: 'text', title: '按鈕文字', type: 'string', initialValue: '看行程' }),
        defineField({ name: 'link', title: '連結', type: 'string', initialValue: '/tours' }),
      ],
    }),

    // === 關於我們（WhoWeAre）===
    defineField({
      name: 'whoWeAreVideoUrl',
      title: '介紹影片 URL',
      type: 'url',
      group: 'whoWeAre',
      description: '從 Cloudinary 複製影片 URL（支援直式或橫式影片）',
    }),
    defineField({
      name: 'whoWeAreVideoPoster',
      title: '影片封面圖',
      type: 'image',
      group: 'whoWeAre',
      options: { hotspot: true },
      description: '影片載入前顯示的封面圖（建議與影片同比例）',
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt 文字',
          type: 'string',
          initialValue: '清微旅行 Eric & Min 一家',
        }),
      ],
    }),
    defineField({
      name: 'whoWeAreVideoAspect',
      title: '影片比例',
      type: 'string',
      group: 'whoWeAre',
      options: {
        list: [
          { title: '直式 9:16（手機拍攝）', value: 'portrait' },
          { title: '橫式 16:9（一般影片）', value: 'landscape' },
          { title: '正方形 1:1', value: 'square' },
        ],
      },
      initialValue: 'portrait',
    }),
    defineField({
      name: 'whoWeAreTitle',
      title: '標題',
      type: 'string',
      group: 'whoWeAre',
      initialValue: '嗨，我們是 Eric & Min',
    }),
    defineField({
      name: 'whoWeAreSubtitle',
      title: '副標題',
      type: 'string',
      group: 'whoWeAre',
      initialValue: '台灣爸爸 × 在地 30 年泰國媽媽',
    }),
    defineField({
      name: 'whoWeAreDescription',
      title: '說明文字',
      type: 'string',
      group: 'whoWeAre',
      initialValue: '帶著女兒 Miya，為親子家庭設計清邁旅程。',
    }),
    defineField({
      name: 'whoWeAreTrustPoints',
      title: '信任點',
      type: 'array',
      group: 'whoWeAre',
      of: [{ type: 'string' }],
      initialValue: [
        '媽媽在地 30 年，路線私房不踩雷',
        '爸爸懂台灣家庭，溝通零距離',
        '司機專心開車，導遊專心服務',
      ],
    }),
    defineField({
      name: 'whoWeAreStoryLink',
      title: '故事連結',
      type: 'string',
      group: 'whoWeAre',
      initialValue: '/blog/eric-story-taiwan-to-chiang-mai',
      description: '「閱讀我們的故事」按鈕連結',
    }),
    defineField({
      name: 'whoWeAreStoryLinkText',
      title: '故事連結文字',
      type: 'string',
      group: 'whoWeAre',
      initialValue: '閱讀我們的故事',
    }),

    // === 精選文章 ===
    defineField({
      name: 'articlesSectionTitle',
      title: '區塊標題',
      type: 'string',
      group: 'articles',
      initialValue: '精選文章',
    }),
    defineField({
      name: 'articlesSectionSubtitle',
      title: '區塊副標題',
      type: 'string',
      group: 'articles',
      initialValue: '在地爸媽的清邁旅遊攻略',
    }),
    defineField({
      name: 'articlesShowCount',
      title: '顯示篇數',
      type: 'number',
      group: 'articles',
      initialValue: 3,
      validation: (Rule) => Rule.min(1).max(6),
    }),

    // === 最終 CTA ===
    defineField({
      name: 'ctaTitle',
      title: '標題',
      type: 'string',
      group: 'cta',
      initialValue: '每個家庭都不一樣',
    }),
    defineField({
      name: 'ctaDescription',
      title: '說明',
      type: 'string',
      group: 'cta',
      initialValue: '聊聊你們的想法，我們幫你規劃',
    }),
    defineField({
      name: 'ctaPrimaryCta',
      title: '主要按鈕',
      type: 'object',
      group: 'cta',
      fields: [
        defineField({ name: 'text', title: '按鈕文字', type: 'string', initialValue: 'LINE 聊聊' }),
        defineField({ name: 'link', title: '連結', type: 'url', initialValue: 'https://line.me/R/ti/p/@037nyuwk' }),
      ],
    }),
    defineField({
      name: 'ctaSecondaryCta',
      title: '次要按鈕（可選）',
      type: 'object',
      group: 'cta',
      fields: [
        defineField({ name: 'text', title: '按鈕文字', type: 'string' }),
        defineField({ name: 'link', title: '連結', type: 'string' }),
      ],
    }),

    // === SEO ===
    defineField({
      name: 'seoTitle',
      title: 'Meta Title',
      type: 'string',
      group: 'seo',
      description: '留空則使用預設標題',
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
      return { title: '首頁設定' }
    },
  },
})
