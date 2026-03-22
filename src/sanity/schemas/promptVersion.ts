import { defineArrayMember, defineField, defineType } from 'sanity'

export default defineType({
  name: 'promptVersion',
  title: 'Prompt Version',
  type: 'document',
  groups: [
    { name: 'config', title: 'Config', default: true },
    { name: 'prompt', title: 'Prompt' },
    { name: 'benchmarks', title: 'Benchmarks' },
  ],
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      group: 'config',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'phase',
      title: 'Phase',
      type: 'string',
      group: 'config',
      options: {
        list: ['7.1', '7.2', '7.3'],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'isActive',
      title: 'Is Active',
      type: 'boolean',
      group: 'config',
      initialValue: false,
    }),
    defineField({
      name: 'systemPrompt',
      title: 'System Prompt',
      type: 'text',
      rows: 16,
      group: 'prompt',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'styleRules',
      title: 'Style Rules',
      type: 'array',
      group: 'prompt',
      of: [defineArrayMember({ type: 'string' })],
    }),
    defineField({
      name: 'benchmarkCases',
      title: 'Benchmark Cases',
      type: 'array',
      group: 'benchmarks',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'title',
              title: 'Title',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'customerInput',
              title: 'Customer Input',
              type: 'text',
              rows: 4,
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'expectedReply',
              title: 'Expected Reply',
              type: 'text',
              rows: 4,
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: {
              title: 'title',
              subtitle: 'customerInput',
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'text',
      rows: 4,
      group: 'config',
    }),
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'phase',
      active: 'isActive',
    },
    prepare({ title, subtitle, active }) {
      return {
        title,
        subtitle: `${subtitle}${active ? ' | active' : ''}`,
      }
    },
  },
})
