import { defineArrayMember, defineField, defineType } from 'sanity'

export default defineType({
  name: 'carCharter',
  title: 'Car Charter / 包車服務頁',
  type: 'document',
  groups: [
    { name: 'hero', title: 'Hero', default: true },
    { name: 'video', title: 'Video / 影片' },
    { name: 'features', title: 'Features / 服務特色' },
    { name: 'pricing', title: 'Pricing / 價格' },
    { name: 'process', title: 'Process / 預訂流程' },
    { name: 'gallery', title: 'Gallery / 照片' },
    { name: 'faq', title: 'FAQ / 常見問題' },
    { name: 'cta', title: 'Bottom CTA / 底部 CTA' },
  ],
  fields: [
    defineField({
      name: 'heroTitle',
      title: 'Hero Title / 主標題',
      type: 'string',
      group: 'hero',
      initialValue: '清邁親子包車服務',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'heroSubtitle',
      title: 'Hero Subtitle / 副標',
      type: 'text',
      group: 'hero',
      rows: 3,
      initialValue:
        '由台灣爸爸 Eric 與泰國媽媽 Min 協助安排，從接送、配車到行程節奏都先替家庭想好。司機與中文導遊分工，不必一路趕景點，也不需要邊玩邊猜下一站怎麼走。',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'heroCtaText',
      title: 'Hero Primary CTA Text / 主按鈕文字',
      type: 'string',
      group: 'hero',
      initialValue: 'LINE 詢問包車與報價',
    }),
    defineField({
      name: 'heroCtaLink',
      title: 'Hero Primary CTA Link / 主按鈕連結',
      type: 'url',
      group: 'hero',
      initialValue: 'https://line.me/R/ti/p/@037nyuwk',
    }),
    defineField({
      name: 'heroHighlights',
      title: 'Hero Highlight Cards / Hero 重點卡',
      type: 'array',
      group: 'hero',
      description: 'Hero 區塊下方的三張重點卡。建議 3 張即可。',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({ name: 'icon', title: 'Icon', type: 'string' }),
            defineField({
              name: 'title',
              title: 'Title / 標題',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'description',
              title: 'Description / 說明',
              type: 'text',
              rows: 2,
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: { title: 'title', subtitle: 'description', icon: 'icon' },
            prepare: ({ title, subtitle, icon }) => ({
              title: `${icon || ''} ${title || ''}`.trim(),
              subtitle,
            }),
          },
        }),
      ],
    }),
    defineField({
      name: 'introCards',
      title: 'Intro Cards / Hero 下方三張卡',
      type: 'array',
      group: 'hero',
      description: 'Hero 下方的三張資訊卡。適合放適合對象、溝通方式、流程提示。',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'title',
              title: 'Title / 標題',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'description',
              title: 'Description / 說明',
              type: 'text',
              rows: 3,
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: { title: 'title', subtitle: 'description' },
          },
        }),
      ],
    }),

    defineField({
      name: 'videoUrl',
      title: 'Video URL / 影片網址',
      type: 'url',
      group: 'video',
      description: '可放 Cloudinary 或可直接播放的影片網址。',
    }),
    defineField({
      name: 'videoPoster',
      title: 'Video Poster / 影片封面',
      type: 'image',
      group: 'video',
      options: { hotspot: true },
    }),
    defineField({
      name: 'videoTitle',
      title: 'Video Title / 影片標題',
      type: 'string',
      group: 'video',
    }),
    defineField({
      name: 'planningChecklist',
      title: 'Planning Checklist / 規劃檢查清單',
      type: 'array',
      group: 'video',
      description: '影片右側的清單。建議 3-5 點。',
      of: [{ type: 'string' }],
    }),

    defineField({
      name: 'features',
      title: 'Service Features / 服務特色',
      type: 'array',
      group: 'features',
      description: '包車頁主體的特色卡片。',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({ name: 'icon', title: 'Icon', type: 'string' }),
            defineField({
              name: 'title',
              title: 'Title / 標題',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'description',
              title: 'Description / 說明',
              type: 'text',
              rows: 2,
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: { title: 'title', subtitle: 'description', icon: 'icon' },
            prepare: ({ title, subtitle, icon }) => ({
              title: `${icon || ''} ${title || ''}`.trim(),
              subtitle,
            }),
          },
        }),
      ],
    }),

    defineField({
      name: 'pricingSectionTitle',
      title: 'Pricing Title / 價格區標題',
      type: 'string',
      group: 'pricing',
      initialValue: '包車價格參考',
    }),
    defineField({
      name: 'pricingVehicleTypes',
      title: 'Vehicle Types / 車型與價格',
      type: 'array',
      group: 'pricing',
      description: '每張價格卡代表一種車型。至少建議 1 種。',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'name',
              title: 'Vehicle Name / 車型名稱',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'subtitle',
              title: 'Subtitle / 副標',
              type: 'string',
            }),
            defineField({ name: 'icon', title: 'Icon', type: 'string' }),
            defineField({
              name: 'maxPassengers',
              title: 'Max Passengers / 最多人數',
              type: 'number',
            }),
            defineField({
              name: 'routes',
              title: 'Routes / 路線',
              type: 'array',
              of: [
                defineArrayMember({
                  type: 'object',
                  fields: [
                    defineField({
                      name: 'destination',
                      title: 'Destination / 路線名稱',
                      type: 'string',
                      validation: (Rule) => Rule.required(),
                    }),
                    defineField({
                      name: 'price',
                      title: 'Price / 價格',
                      type: 'string',
                      validation: (Rule) => Rule.required(),
                    }),
                  ],
                  preview: {
                    select: { title: 'destination', subtitle: 'price' },
                  },
                }),
              ],
            }),
            defineField({
              name: 'airportTransfer',
              title: 'Airport Transfer / 機場接送',
              type: 'object',
              fields: [
                defineField({
                  name: 'label',
                  title: 'Label / 標籤',
                  type: 'string',
                  initialValue: '機場接送',
                }),
                defineField({ name: 'price', title: 'Price / 價格', type: 'string' }),
              ],
            }),
          ],
          preview: {
            select: { title: 'name', subtitle: 'subtitle', icon: 'icon' },
            prepare: ({ title, subtitle, icon }) => ({
              title: `${icon || ''} ${title || ''}`.trim(),
              subtitle,
            }),
          },
        }),
      ],
    }),
    defineField({
      name: 'pricingFootnotes',
      title: 'Pricing Footnotes / 價格備註',
      type: 'array',
      group: 'pricing',
      of: [{ type: 'string' }],
    }),

    defineField({
      name: 'process',
      title: 'Booking Process / 預訂流程',
      type: 'array',
      group: 'process',
      description: '從詢問到出發的步驟。建議依實際流程排序。',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({ name: 'step', title: 'Step / 步驟', type: 'number' }),
            defineField({
              name: 'title',
              title: 'Title / 標題',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'description',
              title: 'Description / 說明',
              type: 'text',
              rows: 2,
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: { title: 'title', step: 'step' },
            prepare: ({ title, step }) => ({
              title: `${step || ''}. ${title || ''}`.trim(),
            }),
          },
        }),
      ],
    }),

    defineField({
      name: 'gallery',
      title: 'Gallery / 車輛照片',
      type: 'array',
      group: 'gallery',
      of: [
        defineArrayMember({
          type: 'image',
          options: { hotspot: true },
          fields: [
            defineField({ name: 'alt', title: 'Alt Text / 替代文字', type: 'string' }),
            defineField({ name: 'caption', title: 'Caption / 圖說', type: 'string' }),
          ],
        }),
      ],
    }),

    defineField({
      name: 'faq',
      title: 'FAQ / 常見問題',
      type: 'array',
      group: 'faq',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'question',
              title: 'Question / 問題',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'answer',
              title: 'Answer / 回答',
              type: 'text',
              rows: 3,
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: { title: 'question' },
          },
        }),
      ],
    }),
    defineField({
      name: 'supportPanelTitle',
      title: 'Support Panel Title / FAQ 側欄標題',
      type: 'string',
      group: 'faq',
    }),
    defineField({
      name: 'supportPanelDescription',
      title: 'Support Panel Description / FAQ 側欄說明',
      type: 'text',
      group: 'faq',
      rows: 3,
    }),
    defineField({
      name: 'supportPanelFacts',
      title: 'Support Panel Facts / FAQ 側欄資訊卡',
      type: 'array',
      group: 'faq',
      description: '補充 FAQ 側欄的資訊卡。電話會由站點設定自動帶入，這裡填其他輔助資訊即可。',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'label',
              title: 'Label / 標籤',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'value',
              title: 'Value / 內容',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: { title: 'label', subtitle: 'value' },
          },
        }),
      ],
    }),

    defineField({
      name: 'bottomCtaTitle',
      title: 'Bottom CTA Title / 底部 CTA 標題',
      type: 'string',
      group: 'cta',
    }),
    defineField({
      name: 'bottomCtaDescription',
      title: 'Bottom CTA Description / 底部 CTA 說明',
      type: 'text',
      group: 'cta',
      rows: 3,
    }),

    defineField({ name: 'videoShow', type: 'boolean', hidden: true }),
    defineField({ name: 'videoYoutubeId', type: 'string', hidden: true }),
    defineField({ name: 'seoTitle', type: 'string', hidden: true }),
    defineField({ name: 'seoDescription', type: 'text', hidden: true }),
  ],
  preview: {
    prepare() {
      return {
        title: 'Car Charter / 包車服務頁',
      }
    },
  },
})
