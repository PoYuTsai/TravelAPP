// src/sanity/schemas/dayTour.ts
import { defineType, defineField, defineArrayMember } from 'sanity'

export default defineType({
  name: 'dayTour',
  title: '一日遊',
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
      title: '行程名稱',
      type: 'string',
      group: 'basic',
      description: '例：茵他儂一日遊',
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
      description: '例：雙佛塔 × 生態村 × 高山咖啡',
    }),
    defineField({
      name: 'description',
      title: '行程介紹',
      type: 'text',
      group: 'basic',
      rows: 3,
      description: '一段簡短的行程描述',
    }),
    defineField({
      name: 'location',
      title: '目的地',
      type: 'string',
      group: 'basic',
      options: {
        list: [
          { title: '茵他儂', value: 'doi-inthanon' },
          { title: '清萊', value: 'chiang-rai' },
          { title: '南邦', value: 'lampang' },
          { title: '南奔', value: 'lamphun' },
          { title: '清邁', value: 'chiang-mai' },
        ],
      },
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
      name: 'highlights',
      title: '亮點標籤',
      type: 'array',
      group: 'basic',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description: '例：泰國最高峰、雙佛塔、高山咖啡',
    }),
    defineField({
      name: 'order',
      title: '排序',
      type: 'number',
      group: 'basic',
      initialValue: 0,
    }),

    // === 行程內容 ===
    defineField({
      name: 'stops',
      title: '行程景點',
      type: 'array',
      group: 'content',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'emoji',
              title: 'Emoji',
              type: 'string',
              description: '例：🌿 🍏 🌲',
            }),
            defineField({
              name: 'name',
              title: '景點名稱',
              type: 'string',
            }),
            defineField({
              name: 'description',
              title: '景點描述',
              type: 'text',
              rows: 2,
            }),
            defineField({
              name: 'image',
              title: '景點圖片',
              type: 'image',
              options: { hotspot: true },
              fields: [
                defineField({
                  name: 'alt',
                  title: '圖片描述',
                  type: 'string',
                }),
              ],
            }),
          ],
          preview: {
            select: { name: 'name', emoji: 'emoji', media: 'image' },
            prepare: ({ name, emoji, media }) => ({
              title: `${emoji || ''} ${name}`,
              media,
            }),
          },
        }),
      ],
    }),
    defineField({
      name: 'tips',
      title: '貼心建議',
      type: 'array',
      group: 'content',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'additionalInfo',
      title: '額外說明',
      type: 'text',
      group: 'content',
      rows: 6,
      description: '較長的補充說明（如大象營詳細內容）',
    }),

    // === 價格資訊 ===
    defineField({
      name: 'pricingTier',
      title: '人頭計價區域',
      type: 'string',
      group: 'pricing',
      description: '官網依總佔位人數與此服務區域說明計價。',
      options: {
        list: [
          { title: 'T1 市區', value: 'T1' },
          { title: 'T2 近郊', value: 'T2' },
          { title: 'T3 清萊', value: 'T3' },
          { title: 'T4 金三角', value: 'T4' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'basePrice',
      title: '基本價格',
      type: 'number',
      group: 'pricing',
      hidden: true,
      readOnly: true,
      description: 'DEPRECATED：舊固定團價，僅保留資料相容，不得用於公開呈現。',
    }),
    defineField({
      name: 'priceUnit',
      title: '價格單位',
      type: 'string',
      group: 'pricing',
      initialValue: '/團',
      hidden: true,
      readOnly: true,
      description: 'DEPRECATED：舊價格單位，僅保留資料相容，不得用於公開呈現。',
    }),
    defineField({
      name: 'priceNote',
      title: '價格說明',
      type: 'string',
      group: 'pricing',
      hidden: true,
      readOnly: true,
      description: 'DEPRECATED：舊價格備註，僅保留資料相容，不得用於公開呈現。',
    }),
    defineField({
      name: 'guidePrice',
      title: '導遊加購價',
      type: 'number',
      group: 'pricing',
      hidden: true,
      readOnly: true,
      description: 'DEPRECATED：舊固定導遊加價，僅保留資料相容，不得用於公開呈現。',
    }),
    defineField({
      name: 'includes',
      title: '費用包含',
      type: 'array',
      group: 'pricing',
      hidden: true,
      readOnly: true,
      description: 'DEPRECATED / CODE-OWNED：公開一日遊頁使用程式固定內容，此欄僅保留舊資料相容。',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'excludes',
      title: '費用不含',
      type: 'array',
      group: 'pricing',
      hidden: true,
      readOnly: true,
      description: 'DEPRECATED / CODE-OWNED：公開一日遊頁使用程式固定內容，此欄僅保留舊資料相容。',
      of: [{ type: 'string' }],
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'subtitle',
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
