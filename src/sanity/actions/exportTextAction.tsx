// src/sanity/actions/exportTextAction.tsx
import { useState } from 'react'
import { DocumentActionComponent } from 'sanity'
import { useToast } from '@sanity/ui'
import { DocumentTextIcon } from '@sanity/icons'

export const exportTextAction: DocumentActionComponent = (props) => {
  const { id, type, published } = props
  const toast = useToast()
  const [isLoading, setIsLoading] = useState(false)

  // 只在 itinerary 類型顯示
  if (type !== 'itinerary') {
    return null
  }

  // 取得 published ID（移除 drafts. 前綴）
  const publishedId = id.replace(/^drafts\./, '')

  return {
    label: isLoading ? '產生中...' : '匯出 LINE 文字',
    icon: DocumentTextIcon,
    disabled: !published || isLoading,
    title: published ? '複製行程到 LINE' : '請先發布文件',
    onHandle: async () => {
      setIsLoading(true)
      try {
        // 取得簽名 URL
        const response = await fetch(`/api/sign-url?id=${publishedId}&type=text`)
        if (!response.ok) {
          throw new Error('Failed to generate signed URL')
        }
        const { url } = await response.json()

        // 開啟簽名 URL
        window.open(url, '_blank')
      } catch (error) {
        toast.push({
          status: 'error',
          title: '匯出失敗',
          description: '無法產生文字匯出連結',
        })
      } finally {
        setIsLoading(false)
      }
    },
  }
}
