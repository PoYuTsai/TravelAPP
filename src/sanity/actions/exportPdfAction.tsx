// src/sanity/actions/exportPdfAction.tsx
import { DocumentActionComponent } from 'sanity'
import { DownloadIcon } from '@sanity/icons'

export const exportPdfAction: DocumentActionComponent = (props) => {
  const { id, type, published } = props

  // 只在 itinerary 類型顯示
  if (type !== 'itinerary') {
    return null
  }

  // 取得 published ID（移除 drafts. 前綴）
  const publishedId = id.replace(/^drafts\./, '')

  return {
    label: '匯出 PDF',
    icon: DownloadIcon,
    disabled: !published,
    title: published ? '下載行程表 PDF' : '請先發布文件',
    onHandle: () => {
      // 開啟 PDF 下載連結，加上時間戳避免快取
      const url = `/api/itinerary/${publishedId}/pdf?t=${Date.now()}`
      window.open(url, '_blank')
    },
  }
}
