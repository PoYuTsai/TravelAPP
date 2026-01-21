// src/sanity/actions/exportExcelAction.tsx
import { DocumentActionComponent } from 'sanity'
import { DocumentSheetIcon } from '@sanity/icons'

export const exportExcelAction: DocumentActionComponent = (props) => {
  const { id, type, published } = props

  // 只在 itinerary 類型顯示
  if (type !== 'itinerary') {
    return null
  }

  // 取得 published ID（移除 drafts. 前綴）
  const publishedId = id.replace(/^drafts\./, '')

  return {
    label: '匯出 Excel',
    icon: DocumentSheetIcon,
    disabled: !published,
    title: published ? '下載行程表 Excel' : '請先發布文件',
    onHandle: () => {
      // 開啟 Excel 下載連結，加上時間戳避免快取
      const url = `/api/itinerary/${publishedId}/excel?t=${Date.now()}`
      window.open(url, '_blank')
    },
  }
}
