import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'pricingExample',
  title: 'Pricing Examples / 報價案例',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: '案例名稱',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'variant',
      title: '版本',
      type: 'string',
      options: {
        list: [
          { title: '報價計算測試 v1', value: 'legacy' },
          { title: '報價計算（正式版）', value: 'formal' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'createdAt',
      title: '建立時間',
      type: 'datetime',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'updatedAt',
      title: '更新時間',
      type: 'datetime',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'createdByName',
      title: '建立者',
      type: 'string',
      readOnly: true,
    }),
    defineField({
      name: 'createdByEmail',
      title: '建立者 Email',
      type: 'string',
      readOnly: true,
    }),
    defineField({
      name: 'itineraryPreview',
      title: '行程摘要',
      type: 'text',
      rows: 3,
      readOnly: true,
    }),
    defineField({
      name: 'payload',
      title: '案例資料 JSON',
      type: 'text',
      rows: 16,
      hidden: true,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'publicSlug',
      title: '公開連結代碼',
      type: 'slug',
      description: '報價展示頁的公開網址。產生後不要修改。',
      options: {
        source: 'name',
        maxLength: 12,
      },
    }),
    defineField({
      name: 'photos',
      title: '行程照片',
      type: 'array',
      description: '每日行程照片，每天最多 3 張',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'dayIndex', title: '第幾天 (0-based)', type: 'number' },
            {
              name: 'images',
              title: '照片 (最多3張)',
              type: 'array',
              of: [{ type: 'image', options: { hotspot: true } }],
              validation: (Rule: any) => Rule.max(3),
            },
          ],
        },
      ],
    }),
  ],
  preview: {
    select: {
      title: 'name',
      variant: 'variant',
      createdByName: 'createdByName',
      updatedAt: 'updatedAt',
    },
    prepare(selection) {
      const variantLabel =
        selection.variant === 'formal' ? '正式版' : '測試 v1'

      return {
        title: selection.title,
        subtitle: [variantLabel, selection.createdByName, selection.updatedAt]
          .filter(Boolean)
          .join(' • '),
      }
    },
  },
})
