// src/sanity/schemas/activity.ts
import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'activity',
  title: '活動資料庫',
  type: 'document',
  groups: [
    { name: 'basic', title: '基本資訊', default: true },
    { name: 'pricing', title: '價格資訊' },
    { name: 'matching', title: '智能匹配' },
  ],
  fields: [
    // === 基本資訊 ===
    defineField({
      name: 'name',
      title: '活動名稱',
      type: 'string',
      group: 'basic',
      description: '例：大象保護營（含餐）、白廟',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'activityType',
      title: '活動類型',
      type: 'string',
      group: 'basic',
      options: {
        list: [
          { title: '🎫 門票', value: 'ticket' },
          { title: '🎯 體驗活動', value: 'experience' },
          { title: '🆓 免費景點', value: 'free' },
        ],
        layout: 'radio',
      },
      initialValue: 'ticket',
    }),
    defineField({
      name: 'location',
      title: '地區',
      type: 'string',
      group: 'basic',
      options: {
        list: [
          { title: '清邁市區', value: 'city' },
          { title: '清邁郊區', value: 'suburban' },
          { title: '清萊', value: 'chiang-rai' },
          { title: '茵他儂', value: 'doi-inthanon' },
          { title: '拜縣', value: 'pai' },
          { title: '南邦', value: 'lampang' },
        ],
      },
    }),
    defineField({
      name: 'isActive',
      title: '啟用中',
      type: 'boolean',
      group: 'basic',
      initialValue: true,
      description: '關閉後不會出現在報價計算器',
    }),

    // === 價格資訊 ===
    defineField({
      name: 'adultPrice',
      title: '成人價（泰銖）',
      type: 'number',
      group: 'pricing',
      description: '對客戶的報價',
      validation: (Rule) => Rule.required().min(0),
    }),
    defineField({
      name: 'childPrice',
      title: '兒童價（泰銖）',
      type: 'number',
      group: 'pricing',
      description: '若無兒童價，留空即可',
    }),
    defineField({
      name: 'rebate',
      title: '退傭（泰銖）',
      type: 'number',
      group: 'pricing',
      description: '活動方給的退傭',
      initialValue: 0,
    }),
    defineField({
      name: 'splitRebate',
      title: '退傭對分',
      type: 'boolean',
      group: 'pricing',
      initialValue: true,
      description: '開啟：退傭與客戶對分（顯示為折扣）',
    }),

    // === 智能匹配 ===
    defineField({
      name: 'keywords',
      title: '匹配關鍵字',
      type: 'array',
      group: 'matching',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description: '智能解析時用來匹配的關鍵字，例：大象、elephant、湄登',
    }),
    defineField({
      name: 'exclusiveGroup',
      title: '互斥群組',
      type: 'string',
      group: 'matching',
      description: '同群組的活動只能選一個，例：elephant、cabaret、shooting、zipline',
      options: {
        list: [
          { title: '🐘 大象（含餐/不含餐）', value: 'elephant' },
          { title: '💃 人妖秀（VIP/普通）', value: 'cabaret' },
          { title: '🔫 射擊（基本/進階）', value: 'shooting' },
          { title: '🌲 叢林飛索（A/B/C）', value: 'zipline' },
        ],
      },
    }),
    defineField({
      name: 'isDefaultInGroup',
      title: '群組預設選項',
      type: 'boolean',
      group: 'matching',
      initialValue: false,
      description: '在互斥群組中，這個是預設被選中的選項',
    }),
    defineField({
      name: 'sortOrder',
      title: '排序',
      type: 'number',
      group: 'basic',
      initialValue: 0,
      description: '數字越小越前面',
    }),
  ],
  preview: {
    select: {
      title: 'name',
      price: 'adultPrice',
      rebate: 'rebate',
      type: 'activityType',
      isActive: 'isActive',
    },
    prepare: ({ title, price, rebate, type, isActive }) => {
      const typeIcon = type === 'ticket' ? '🎫' : type === 'experience' ? '🎯' : '🆓'
      const status = isActive ? '' : '⏸️ '
      return {
        title: `${status}${title}`,
        subtitle: `${typeIcon} ฿${price || 0} (退傭 ฿${rebate || 0})`,
      }
    },
  },
  orderings: [
    {
      title: '排序',
      name: 'sortOrderAsc',
      by: [{ field: 'sortOrder', direction: 'asc' }],
    },
    {
      title: '名稱',
      name: 'nameAsc',
      by: [{ field: 'name', direction: 'asc' }],
    },
  ],
})
