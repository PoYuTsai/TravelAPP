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
      name: 'basePrice',
      title: '基本價格',
      type: 'number',
      group: 'pricing',
      description: '例：4000',
    }),
    defineField({
      name: 'priceUnit',
      title: '價格單位',
      type: 'string',
      group: 'pricing',
      initialValue: '/團',
      description: '例：/團、/人',
    }),
    defineField({
      name: 'priceNote',
      title: '價格說明',
      type: 'string',
      group: 'pricing',
      description: '例：包車VIP豪華9人座',
    }),
    defineField({
      name: 'guidePrice',
      title: '導遊加購價',
      type: 'number',
      group: 'pricing',
      description: '例：2500',
    }),
    defineField({
      name: 'includes',
      title: '費用包含',
      type: 'array',
      group: 'pricing',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'excludes',
      title: '費用不含',
      type: 'array',
      group: 'pricing',
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
