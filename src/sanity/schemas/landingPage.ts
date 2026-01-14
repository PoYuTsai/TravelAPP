import { defineType, defineField, defineArrayMember } from 'sanity'

export default defineType({
  name: 'landingPage',
  title: '首頁設定',
  type: 'document',
  groups: [
    { name: 'hero', title: 'Hero 區塊', default: true },
    { name: 'trust', title: '信任數據' },
    { name: 'services', title: '服務區塊' },
    { name: 'whyUs', title: '為什麼選擇我們' },
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
      initialValue: '清邁親子自由行',
    }),
    defineField({
      name: 'heroSubtitle',
      title: '副標題',
      type: 'string',
      group: 'hero',
      initialValue: '在地家庭經營，專為爸媽設計的旅程',
    }),
    defineField({
      name: 'heroDescription',
      title: '說明文字',
      type: 'text',
      group: 'hero',
      rows: 2,
      initialValue: 'Eric & Min，住在清邁的台泰夫妻，我們也有女兒，懂爸媽帶小孩出遊的需求',
    }),
    defineField({
      name: 'heroPrimaryCta',
      title: '主要 CTA',
      type: 'object',
      group: 'hero',
      fields: [
        defineField({ name: 'text', title: '按鈕文字', type: 'string', initialValue: 'LINE 免費諮詢' }),
        defineField({ name: 'link', title: '連結', type: 'url' }),
      ],
    }),
    defineField({
      name: 'heroSecondaryCta',
      title: '次要 CTA',
      type: 'object',
      group: 'hero',
      fields: [
        defineField({ name: 'text', title: '按鈕文字', type: 'string', initialValue: '瀏覽服務' }),
        defineField({ name: 'link', title: '連結', type: 'string', initialValue: '/services/car-charter' }),
      ],
    }),

    // === 信任數據 ===
    defineField({
      name: 'trustNumbers',
      title: '信任數據',
      type: 'array',
      group: 'trust',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({ name: 'value', title: '數值', type: 'string', description: '例如: 110+、⭐⭐⭐⭐⭐、2024' }),
            defineField({ name: 'label', title: '標籤', type: 'string' }),
            defineField({ name: 'link', title: '連結（可選）', type: 'url' }),
          ],
          preview: {
            select: { title: 'label', subtitle: 'value' },
          },
        }),
      ],
    }),

    // === 服務區塊 ===
    defineField({
      name: 'servicesSectionTitle',
      title: '區塊標題',
      type: 'string',
      group: 'services',
      initialValue: '我們的服務',
    }),
    defineField({
      name: 'servicesSectionSubtitle',
      title: '區塊副標題',
      type: 'string',
      group: 'services',
      initialValue: '包車 + 住宿，一站式親子旅遊體驗',
    }),
    defineField({
      name: 'servicesItems',
      title: '服務項目',
      type: 'array',
      group: 'services',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'image',
              title: '服務圖片',
              type: 'image',
              options: { hotspot: true },
              fields: [
                defineField({ name: 'alt', title: 'Alt 文字', type: 'string' }),
              ],
            }),
            defineField({ name: 'title', title: '服務名稱', type: 'string' }),
            defineField({ name: 'subtitle', title: '副標題（可選）', type: 'string' }),
            defineField({
              name: 'features',
              title: '特色列表',
              type: 'array',
              of: [{ type: 'string' }],
            }),
            defineField({ name: 'price', title: '價格顯示（可選）', type: 'string' }),
            defineField({ name: 'ctaText', title: 'CTA 文字', type: 'string' }),
            defineField({ name: 'ctaLink', title: 'CTA 連結', type: 'string' }),
          ],
          preview: {
            select: { title: 'title', subtitle: 'subtitle', media: 'image' },
          },
        }),
      ],
    }),

    // === 為什麼選擇我們 ===
    defineField({
      name: 'whyUsSectionTitle',
      title: '區塊標題',
      type: 'string',
      group: 'whyUs',
      initialValue: '為什麼選擇清微旅行',
    }),
    defineField({
      name: 'whyUsSectionSubtitle',
      title: '區塊副標題',
      type: 'string',
      group: 'whyUs',
      initialValue: '不只是包車，更是您在清邁的家人',
    }),
    defineField({
      name: 'whyUsReasons',
      title: '理由',
      type: 'array',
      group: 'whyUs',
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

    // === 精選文章設定 ===
    defineField({
      name: 'articlesSectionTitle',
      title: '區塊標題',
      type: 'string',
      group: 'articles',
      initialValue: '旅遊攻略',
    }),
    defineField({
      name: 'articlesSectionSubtitle',
      title: '區塊副標題',
      type: 'string',
      group: 'articles',
      initialValue: '在地人的清邁親子旅遊指南',
    }),
    defineField({
      name: 'articlesShowCount',
      title: '顯示篇數',
      type: 'number',
      group: 'articles',
      initialValue: 3,
      validation: (Rule) => Rule.min(1).max(6),
    }),
    defineField({
      name: 'articlesCtaText',
      title: '查看更多文字',
      type: 'string',
      group: 'articles',
      initialValue: '查看所有文章',
    }),
    defineField({
      name: 'articlesCtaLink',
      title: '查看更多連結',
      type: 'string',
      group: 'articles',
      initialValue: '/blog',
    }),

    // === 最終 CTA ===
    defineField({
      name: 'ctaTitle',
      title: '標題',
      type: 'string',
      group: 'cta',
      initialValue: '準備好帶孩子來清邁了嗎？',
    }),
    defineField({
      name: 'ctaDescription',
      title: '說明',
      type: 'text',
      group: 'cta',
      rows: 2,
      initialValue: '免費諮詢，讓在地爸媽幫你規劃最適合的親子行程',
    }),
    defineField({
      name: 'ctaPrimaryCta',
      title: '主要 CTA',
      type: 'object',
      group: 'cta',
      fields: [
        defineField({ name: 'text', title: '按鈕文字', type: 'string', initialValue: 'LINE 免費諮詢' }),
        defineField({ name: 'link', title: '連結', type: 'url' }),
      ],
    }),
    defineField({
      name: 'ctaSecondaryCta',
      title: '次要 CTA',
      type: 'object',
      group: 'cta',
      fields: [
        defineField({ name: 'text', title: '按鈕文字', type: 'string', initialValue: '瀏覽服務內容' }),
        defineField({ name: 'link', title: '連結', type: 'string', initialValue: '/services/car-charter' }),
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
