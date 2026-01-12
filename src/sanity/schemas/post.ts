import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'post',
  title: '部落格文章',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: '標題',
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
      name: 'excerpt',
      title: '摘要',
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
      name: 'body',
      title: '內容',
      type: 'array',
      of: [
        { type: 'block' },
        { type: 'image', options: { hotspot: true } },
      ],
    }),
    defineField({
      name: 'publishedAt',
      title: '發佈日期',
      type: 'datetime',
    }),
    defineField({
      name: 'categories',
      title: '分類',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: '攻略', value: 'guide' },
          { title: '景點', value: 'attraction' },
          { title: '美食', value: 'food' },
          { title: '住宿', value: 'accommodation' },
        ],
      },
    }),
  ],
  preview: {
    select: { title: 'title', media: 'mainImage' },
  },
})
