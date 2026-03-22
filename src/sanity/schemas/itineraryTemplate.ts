import { defineArrayMember, defineField, defineType } from 'sanity'

export default defineType({
  name: 'itineraryTemplate',
  title: 'Itinerary Template',
  type: 'document',
  groups: [
    { name: 'summary', title: 'Summary', default: true },
    { name: 'content', title: 'Content' },
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'summary',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'templateKey',
      title: 'Template Key',
      type: 'slug',
      group: 'summary',
      options: {
        source: 'title',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'useCases',
      title: 'Use Cases',
      type: 'array',
      group: 'summary',
      of: [defineArrayMember({ type: 'string' })],
    }),
    defineField({
      name: 'outline',
      title: 'Outline',
      type: 'array',
      group: 'content',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'sectionTitle',
              title: 'Section Title',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'sectionPrompt',
              title: 'Section Prompt',
              type: 'text',
              rows: 3,
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: {
              title: 'sectionTitle',
              subtitle: 'sectionPrompt',
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'responseTemplate',
      title: 'Response Template',
      type: 'text',
      rows: 10,
      group: 'content',
    }),
    defineField({
      name: 'isActive',
      title: 'Is Active',
      type: 'boolean',
      group: 'summary',
      initialValue: true,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'templateKey.current',
    },
  },
})
