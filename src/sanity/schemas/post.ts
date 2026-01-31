import { defineType, defineField, defineArrayMember } from 'sanity'

export default defineType({
  name: 'post',
  title: '部落格文章',
  type: 'document',
  groups: [
    { name: 'content', title: '內容', default: true },
    { name: 'seo', title: 'SEO 設定' },
    { name: 'settings', title: '文章設定' },
  ],
  fields: [
    // === 內容群組 ===
    defineField({
      name: 'title',
      title: '文章標題',
      type: 'string',
      group: 'content',
      description: '建議格式：主要關鍵字｜副標題（例：2025清邁親子自由行完整攻略｜景點美食住宿一篇搞定）',
      validation: (Rule) => Rule.required().max(60).warning('標題建議不超過 60 字'),
    }),
    defineField({
      name: 'slug',
      title: '網址代碼',
      type: 'slug',
      group: 'content',
      description: '文章的網址，例：chiang-mai-family-travel-guide-2025',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'mainImage',
      title: '封面圖片',
      type: 'image',
      group: 'content',
      options: { hotspot: true },
      fields: [
        defineField({
          name: 'alt',
          title: '圖片描述（SEO 用）',
          type: 'string',
          description: '描述圖片內容，幫助搜尋引擎理解',
        }),
      ],
    }),
    defineField({
      name: 'excerpt',
      title: '文章摘要',
      type: 'text',
      group: 'content',
      rows: 3,
      description: '顯示在文章列表和社群分享，建議 80-160 字',
      validation: (Rule) => Rule.max(200).warning('摘要建議不超過 200 字'),
    }),
    defineField({
      name: 'body',
      title: '文章內容',
      type: 'array',
      group: 'content',
      of: [
        // 基本文字區塊
        defineArrayMember({
          type: 'block',
          styles: [
            { title: '內文', value: 'normal' },
            { title: '標題 H2', value: 'h2' },
            { title: '標題 H3', value: 'h3' },
            { title: '標題 H4', value: 'h4' },
            { title: '引言', value: 'blockquote' },
          ],
          marks: {
            decorators: [
              { title: '粗體', value: 'strong' },
              { title: '斜體', value: 'em' },
              { title: '底線', value: 'underline' },
              { title: '刪除線', value: 'strike-through' },
              { title: '螢光標記', value: 'highlight' },
            ],
            annotations: [
              {
                name: 'link',
                type: 'object',
                title: '連結',
                fields: [
                  {
                    name: 'href',
                    type: 'url',
                    title: 'URL',
                    validation: (Rule) =>
                      Rule.uri({ allowRelative: true, scheme: ['http', 'https', 'mailto', 'tel'] }),
                  },
                  {
                    name: 'blank',
                    type: 'boolean',
                    title: '在新視窗開啟',
                    initialValue: false,
                  },
                ],
              },
            ],
          },
        }),
        // 圖片
        defineArrayMember({
          type: 'image',
          options: { hotspot: true },
          fields: [
            defineField({
              name: 'alt',
              title: '圖片描述',
              type: 'string',
            }),
            defineField({
              name: 'caption',
              title: '圖片說明',
              type: 'string',
            }),
          ],
        }),
        // LINE 諮詢 CTA
        defineArrayMember({
          name: 'ctaBlock',
          title: 'LINE 諮詢區塊',
          type: 'object',
          fields: [
            defineField({
              name: 'title',
              title: '標題',
              type: 'string',
              initialValue: '需要行程規劃協助嗎？',
            }),
            defineField({
              name: 'description',
              title: '說明文字',
              type: 'string',
              initialValue: '免費諮詢，讓在地人幫你規劃最適合的行程',
            }),
          ],
          preview: {
            select: { title: 'title' },
            prepare: ({ title }) => ({
              title: title || 'LINE 諮詢區塊',
              subtitle: 'CTA 按鈕',
              media: () => '📱',
            }),
          },
        }),
        // 推薦行程區塊
        defineArrayMember({
          name: 'toursBlock',
          title: '推薦行程區塊',
          type: 'object',
          fields: [
            defineField({
              name: 'title',
              title: '區塊標題',
              type: 'string',
              initialValue: '推薦行程',
            }),
            defineField({
              name: 'tours',
              title: '選擇行程',
              type: 'array',
              of: [{ type: 'reference', to: [{ type: 'tourPackage' }] }],
            }),
          ],
          preview: {
            select: { title: 'title' },
            prepare: ({ title }) => ({
              title: title || '推薦行程區塊',
              subtitle: '相關行程推薦',
              media: () => '🚐',
            }),
          },
        }),
        // 資訊提示框
        defineArrayMember({
          name: 'tipBox',
          title: '提示框',
          type: 'object',
          fields: [
            defineField({
              name: 'type',
              title: '類型',
              type: 'string',
              options: {
                list: [
                  { title: '💡 小提醒', value: 'tip' },
                  { title: '⚠️ 注意', value: 'warning' },
                  { title: '✅ 推薦', value: 'success' },
                  { title: '📍 地點資訊', value: 'location' },
                ],
              },
              initialValue: 'tip',
            }),
            defineField({
              name: 'content',
              title: '內容',
              type: 'text',
              rows: 3,
            }),
          ],
          preview: {
            select: { type: 'type', content: 'content' },
            prepare: ({ type, content }) => ({
              title: content?.substring(0, 50) || '提示框',
              subtitle: type === 'tip' ? '💡 小提醒' : type === 'warning' ? '⚠️ 注意' : type === 'success' ? '✅ 推薦' : '📍 地點',
            }),
          },
        }),
        // 表格
        defineArrayMember({
          name: 'tableBlock',
          title: '表格',
          type: 'object',
          fields: [
            defineField({
              name: 'caption',
              title: '表格標題',
              type: 'string',
            }),
            defineField({
              name: 'rows',
              title: '表格內容',
              type: 'array',
              of: [
                {
                  type: 'object',
                  fields: [
                    {
                      name: 'cells',
                      title: '欄位',
                      type: 'array',
                      of: [{ type: 'string' }],
                    },
                    {
                      name: 'isHeader',
                      title: '這是標題列',
                      type: 'boolean',
                      initialValue: false,
                    },
                  ],
                },
              ],
            }),
          ],
          preview: {
            select: { caption: 'caption' },
            prepare: ({ caption }) => ({
              title: caption || '表格',
              subtitle: '資料表格',
              media: () => '📊',
            }),
          },
        }),
        // 影片區塊（支援 Cloudflare Stream 或 YouTube）
        defineArrayMember({
          name: 'videoBlock',
          title: '影片',
          type: 'object',
          fields: [
            defineField({
              name: 'url',
              title: '影片網址',
              type: 'url',
              description: '支援 Cloudflare Stream、YouTube embed 網址',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'caption',
              title: '影片說明',
              type: 'string',
            }),
            defineField({
              name: 'provider',
              title: '平台',
              type: 'string',
              options: {
                list: [
                  { title: 'Cloudflare Stream', value: 'cloudflare' },
                  { title: 'YouTube', value: 'youtube' },
                  { title: '其他', value: 'other' },
                ],
              },
              initialValue: 'cloudflare',
            }),
          ],
          preview: {
            select: { caption: 'caption', url: 'url' },
            prepare: ({ caption, url }) => ({
              title: caption || '影片',
              subtitle: url?.substring(0, 50) || '未設定網址',
              media: () => '🎬',
            }),
          },
        }),
      ],
    }),

    // === SEO 群組 ===
    defineField({
      name: 'seoDescription',
      title: 'SEO 描述',
      type: 'text',
      group: 'seo',
      rows: 3,
      description: 'Google 搜尋結果顯示的描述，建議 120-160 字。留空則使用文章摘要。',
      validation: (Rule) => Rule.max(160).warning('SEO 描述建議不超過 160 字'),
    }),
    defineField({
      name: 'seoKeywords',
      title: 'SEO 關鍵字',
      type: 'array',
      group: 'seo',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description: '輸入主要關鍵字，例：清邁親子、清邁自由行、清邁包車',
    }),

    // === 設定群組 ===
    defineField({
      name: 'category',
      title: '文章分類',
      type: 'string',
      group: 'settings',
      options: {
        list: [
          { title: '攻略', value: 'guide' },
          { title: '景點', value: 'attraction' },
          { title: '美食', value: 'food' },
          { title: '交通', value: 'transportation' },
          { title: '實用', value: 'practical' },
          { title: '故事', value: 'story' },
        ],
        layout: 'radio',
      },
      initialValue: 'guide',
    }),
    defineField({
      name: 'featured',
      title: '精選文章',
      type: 'boolean',
      group: 'settings',
      description: '開啟後會顯示在首頁和部落格列表最上方',
      initialValue: false,
    }),
    defineField({
      name: 'publishedAt',
      title: '發佈日期',
      type: 'datetime',
      group: 'settings',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'updatedAt',
      title: '最後更新',
      type: 'datetime',
      group: 'settings',
      description: 'SEO 用，告訴 Google 文章有更新',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      category: 'category',
      featured: 'featured',
      media: 'mainImage',
    },
    prepare: ({ title, category, featured, media }) => ({
      title: featured ? `⭐ ${title}` : title,
      subtitle: category === 'guide' ? '攻略' : category === 'attraction' ? '景點' : category === 'food' ? '美食' : category === 'transportation' ? '交通' : category === 'practical' ? '實用' : category === 'story' ? '故事' : '文章',
      media,
    }),
  },
  orderings: [
    {
      title: '發佈日期（新到舊）',
      name: 'publishedAtDesc',
      by: [{ field: 'publishedAt', direction: 'desc' }],
    },
    {
      title: '精選優先',
      name: 'featuredFirst',
      by: [
        { field: 'featured', direction: 'desc' },
        { field: 'publishedAt', direction: 'desc' },
      ],
    },
  ],
})
