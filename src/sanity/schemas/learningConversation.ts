import { defineArrayMember, defineField, defineType } from 'sanity'

export default defineType({
  name: 'learningConversation',
  title: 'Learning Conversation',
  type: 'document',
  groups: [
    { name: 'summary', title: 'Summary', default: true },
    { name: 'messages', title: 'Messages' },
    { name: 'review', title: 'Review' },
  ],
  fields: [
    defineField({
      name: 'lineUserId',
      title: 'LINE User ID',
      type: 'string',
      group: 'summary',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'customerName',
      title: 'Customer Name',
      type: 'string',
      group: 'summary',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'conversationStatus',
      title: 'Conversation Status',
      type: 'string',
      group: 'summary',
      options: {
        list: ['waiting_eric', 'waiting_customer', 'cold', 'archived', 'converted'],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'sourceConversationId',
      title: 'Source Conversation ID',
      type: 'string',
      group: 'summary',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'inquirySummary',
      title: 'Inquiry Summary',
      type: 'text',
      rows: 4,
      group: 'summary',
    }),
    defineField({
      name: 'messages',
      title: 'Messages',
      type: 'array',
      group: 'messages',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'role',
              title: 'Role',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'content',
              title: 'Content',
              type: 'text',
              rows: 3,
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'timestamp',
              title: 'Timestamp',
              type: 'datetime',
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: {
              title: 'role',
              subtitle: 'content',
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'promptVersion',
      title: 'Prompt Version',
      type: 'reference',
      to: [{ type: 'promptVersion' }],
      group: 'review',
    }),
    defineField({
      name: 'feedbackTags',
      title: 'Feedback Tags',
      type: 'array',
      group: 'review',
      of: [
        defineArrayMember({
          type: 'string',
          options: {
            list: ['ok', 'too_long', 'too_formal', 'too_cold'],
          },
        }),
      ],
    }),
    defineField({
      name: 'approvedReply',
      title: 'Approved Reply',
      type: 'text',
      rows: 4,
      group: 'review',
    }),
    defineField({
      name: 'createdAt',
      title: 'Created At',
      type: 'datetime',
      group: 'summary',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'archivedAt',
      title: 'Archived At',
      type: 'datetime',
      group: 'summary',
    }),
  ],
  preview: {
    select: {
      title: 'customerName',
      subtitle: 'conversationStatus',
    },
  },
})
