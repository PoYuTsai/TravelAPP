// src/sanity/schemas/tourPackage.ts
import { defineType, defineField, defineArrayMember } from 'sanity'

export default defineType({
  name: 'tourPackage',
  title: '招牌套餐',
  type: 'document',
  groups: [
    { name: 'basic', title: '基本資訊', default: true },
    { name: 'content', title: '行程內容' },
    { name: 'pricing', title: '價格資訊' },
  ],
  fields: [
    // === 基本資訊 ===
    defineField({
      name: 'title',
      title: '套餐名稱',
      type: 'string',
      group: 'basic',
      description: '例：親子經典清邁 5 天 4 夜',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: '網址代碼',
      type: 'slug',
      group: 'basic',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'subtitle',
      title: '副標題',
      type: 'string',
      group: 'basic',
      description: '例：適合第一次來清邁的親子家庭',
    }),
    defineField({
      name: 'coverImage',
      title: '封面圖',
      type: 'image',
      group: 'basic',
      options: { hotspot: true },
      fields: [
        defineField({
          name: 'alt',
          title: '圖片描述',
          type: 'string',
        }),
      ],
    }),
    defineField({
      name: 'duration',
      title: '天數',
      type: 'string',
      group: 'basic',
      description: '例：5天4夜',
    }),
    defineField({
      name: 'highlights',
      title: '亮點標籤',
      type: 'array',
      group: 'basic',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description: '例：大象保護營、夜間動物園',
    }),
    defineField({
      name: 'order',
      title: '排序',
      type: 'number',
      group: 'basic',
      initialValue: 0,
    }),
    defineField({
      name: 'overviewVideo',
      title: '行程總覽影片',
      type: 'string',
      group: 'basic',
      description: '影片路徑，例：/videos/family-tour.mp4（放在 public 資料夾）',
    }),

    // === 行程內容 ===
    defineField({
      name: 'suitableFor',
      title: '這趟旅程適合你，如果...',
      type: 'array',
      group: 'content',
      of: [{ type: 'string' }],
      description: '列出適合的客群特點',
    }),
    defineField({
      name: 'dailySchedule',
      title: '每日行程',
      type: 'array',
      group: 'content',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'day',
              title: '第幾天',
              type: 'number',
            }),
            defineField({
              name: 'emoji',
              title: 'Emoji',
              type: 'string',
              description: '例：✈️ 🐘 🏛️',
            }),
            defineField({
              name: 'title',
              title: '標題',
              type: 'string',
              description: '例：抵達清邁・輕鬆適應',
            }),
            defineField({
              name: 'activities',
              title: '活動內容',
              type: 'text',
              rows: 2,
              description: '例：接機 → 飯店 Check-in → 尼曼區晚餐',
            }),
          ],
          preview: {
            select: { day: 'day', title: 'title', emoji: 'emoji' },
            prepare: ({ day, title, emoji }) => ({
              title: `Day ${day}: ${title}`,
              subtitle: emoji,
            }),
          },
        }),
      ],
    }),
    defineField({
      name: 'includes',
      title: '費用包含',
      type: 'array',
      group: 'content',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'excludes',
      title: '費用不含',
      type: 'array',
      group: 'content',
      of: [{ type: 'string' }],
    }),

    // === 價格資訊 ===
    defineField({
      name: 'priceRange',
      title: '價格範圍',
      type: 'string',
      group: 'pricing',
      description: '例：NT$ 16,000 - 20,000 起',
    }),
    defineField({
      name: 'priceNote',
      title: '價格說明',
      type: 'string',
      group: 'pricing',
      description: '例：依人數、車型、導遊天數調整',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'duration',
      media: 'coverImage',
    },
  },
  orderings: [
    {
      title: '排序',
      name: 'orderAsc',
      by: [{ field: 'order', direction: 'asc' }],
    },
  ],
})
