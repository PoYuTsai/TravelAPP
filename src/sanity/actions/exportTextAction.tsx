// src/sanity/actions/exportTextAction.tsx
import { DocumentTextIcon } from '@sanity/icons'
import { DocumentActionProps } from 'sanity'

export function exportTextAction(props: DocumentActionProps) {
  const { id, type } = props

  // 只在 itinerary 類型顯示
  if (type !== 'itinerary') return null

  // 移除 drafts. 前綴
  const publishedId = id.replace(/^drafts\./, '')

  return {
    label: '匯出 LINE 文字',
    icon: DocumentTextIcon,
    onHandle: () => {
      // 開新視窗顯示純文字（方便複製）
      window.open(`/api/itinerary/${publishedId}/text`, '_blank')
    },
  }
}
