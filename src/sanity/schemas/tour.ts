import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'tour',
  title: '行程',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: '行程名稱',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: '網址代碼',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: '簡介',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'mainImage',
      title: '主圖',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({
      name: 'duration',
      title: '時長',
      type: 'string',
      description: '例如：一日遊、半日遊',
    }),
    defineField({
      name: 'highlights',
      title: '行程亮點',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'itinerary',
      title: '行程內容',
      type: 'array',
      of: [{ type: 'block' }],
    }),
    defineField({
      name: 'includes',
      title: '費用包含',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'rezioUrl',
      title: 'Rezio 連結',
      type: 'url',
    }),
    defineField({
      name: 'featured',
      title: '首頁推薦',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'order',
      title: '排序',
      type: 'number',
    }),
  ],
  orderings: [
    { title: '排序', name: 'orderAsc', by: [{ field: 'order', direction: 'asc' }] },
  ],
  preview: {
    select: { title: 'title', media: 'mainImage' },
  },
})
