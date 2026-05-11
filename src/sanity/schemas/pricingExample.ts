import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'pricingExample',
  title: 'Pricing Examples / 報價範例',
  type: 'document',
  fieldsets: [
    { name: 'internalMeta', title: 'Internal Meta / 內部資訊', options: { collapsible: true, collapsed: true } },
    { name: 'publicShare', title: 'Public Quote / 對外 quote', options: { collapsible: true, collapsed: false } },
    { name: 'paymentControls', title: 'Payment Controls / 付款控制', options: { collapsible: true, collapsed: false } },
    { name: 'paymentSystem', title: 'Payment System Fields / 系統欄位', options: { collapsible: true, collapsed: true } },
  ],
  fields: [
    defineField({
      name: 'name',
      title: 'Quote Name / 報價名稱',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'variant',
      title: 'Variant / 版本',
      type: 'string',
      options: {
        list: [
          { title: 'Legacy Quote v1', value: 'legacy' },
          { title: 'Formal Quote', value: 'formal' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'createdAt',
      title: 'Created At / 建立時間',
      type: 'datetime',
      fieldset: 'internalMeta',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'updatedAt',
      title: 'Updated At / 更新時間',
      type: 'datetime',
      fieldset: 'internalMeta',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'createdByName',
      title: 'Created By / 建立者',
      type: 'string',
      fieldset: 'internalMeta',
      readOnly: true,
    }),
    defineField({
      name: 'createdByEmail',
      title: 'Creator Email / 建立者 Email',
      type: 'string',
      fieldset: 'internalMeta',
      readOnly: true,
    }),
    defineField({
      name: 'itineraryPreview',
      title: 'Itinerary Preview / 行程摘要',
      type: 'text',
      rows: 3,
      fieldset: 'internalMeta',
      readOnly: true,
    }),
    defineField({
      name: 'payload',
      title: 'Quote Payload JSON / 報價資料 JSON',
      type: 'text',
      rows: 16,
      hidden: true,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'publicSlug',
      title: 'Public Slug / 對外連結代碼',
      type: 'slug',
      fieldset: 'publicShare',
      description: '客人專屬 quote 頁面會使用這個 slug，例如 /quote/xxxxxx',
      options: {
        source: 'name',
        maxLength: 12,
      },
    }),
    defineField({
      name: 'photos',
      title: 'Quote Photos / 行程照片',
      type: 'array',
      fieldset: 'publicShare',
      description: '對應每日行程的照片，每天最多 3 張。',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'dayIndex', title: 'Day Index (0-based)', type: 'number' },
            {
              name: 'images',
              title: 'Images / 照片',
              type: 'array',
              of: [{ type: 'image', options: { hotspot: true } }],
              validation: (Rule: any) => Rule.max(3),
            },
          ],
        },
      ],
    }),
    defineField({
      name: 'orderNo',
      title: 'Order Number / 訂單編號',
      type: 'string',
      fieldset: 'paymentControls',
      description: '若留空，系統在開啟付款時會自動補一組訂單編號。',
    }),
    defineField({
      name: 'paymentState',
      title: 'Payment State / 付款狀態',
      type: 'string',
      fieldset: 'paymentControls',
      initialValue: 'draft',
      options: {
        list: [
          { title: 'Draft / 僅報價', value: 'draft' },
          { title: 'Payment Ready / 可付款', value: 'payment_ready' },
          { title: 'Payment Pending / 等待付款', value: 'payment_pending' },
          { title: 'Paid / 已付款', value: 'paid' },
          { title: 'Expired / 已過期', value: 'expired' },
        ],
      },
    }),
    defineField({
      name: 'depositLabel',
      title: 'Deposit Label / 付款項目名稱',
      type: 'string',
      fieldset: 'paymentControls',
      initialValue: '服務訂金',
    }),
    defineField({
      name: 'depositAmountTWD',
      title: 'Deposit Amount (TWD) / 訂金金額',
      type: 'number',
      fieldset: 'paymentControls',
      description: 'Phase A 只收我們自己的服務訂金，不含住宿與票券。',
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: 'paymentExpiresAt',
      title: 'Payment Expires At / 付款期限',
      type: 'datetime',
      fieldset: 'paymentControls',
      description: '超過這個時間後，舊付款連結應視為無效。',
    }),
    defineField({
      name: 'paymentProvider',
      title: 'Payment Provider / 金流供應商',
      type: 'string',
      fieldset: 'paymentSystem',
      initialValue: 'ecpay',
      readOnly: true,
    }),
    defineField({
      name: 'paymentTradeNo',
      title: 'Provider Trade No / 金流交易編號',
      type: 'string',
      fieldset: 'paymentSystem',
      readOnly: true,
    }),
    defineField({
      name: 'paymentUrl',
      title: 'Payment URL / 付款連結',
      type: 'url',
      fieldset: 'paymentSystem',
      readOnly: true,
    }),
    defineField({
      name: 'paymentCreatedAt',
      title: 'Payment Created At / 建立付款時間',
      type: 'datetime',
      fieldset: 'paymentSystem',
      readOnly: true,
    }),
    defineField({
      name: 'paymentPaidAt',
      title: 'Payment Paid At / 完成付款時間',
      type: 'datetime',
      fieldset: 'paymentSystem',
      readOnly: true,
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
        selection.variant === 'formal' ? 'Formal Quote' : 'Legacy Quote v1'

      return {
        title: selection.title,
        subtitle: [variantLabel, selection.createdByName, selection.updatedAt]
          .filter(Boolean)
          .join(' · '),
      }
    },
  },
})
