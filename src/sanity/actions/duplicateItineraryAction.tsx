// src/sanity/actions/duplicateItineraryAction.tsx
import { CopyIcon } from '@sanity/icons'
import { useToast } from '@sanity/ui'
import { useState } from 'react'
import { useClient, DocumentActionProps } from 'sanity'
import { useRouter } from 'sanity/router'

export function duplicateItineraryAction(props: DocumentActionProps) {
  const { id, type, published, draft } = props
  const client = useClient({ apiVersion: '2024-01-01' })
  const toast = useToast()
  const router = useRouter()
  const [isDuplicating, setIsDuplicating] = useState(false)

  // 只在 itinerary 類型顯示
  if (type !== 'itinerary') return null

  const doc = draft || published
  if (!doc) return null

  return {
    label: isDuplicating ? '複製中...' : '複製行程',
    icon: CopyIcon,
    disabled: isDuplicating,
    onHandle: async () => {
      setIsDuplicating(true)

      try {
        // 產生新的文件 ID
        const newId = `drafts.${crypto.randomUUID().slice(0, 8)}`

        // 複製文件，修改客戶名稱
        const newDoc = {
          ...doc,
          _id: newId,
          _type: 'itinerary',
          clientName: `${doc.clientName} (副本)`,
          // 移除系統欄位
          _createdAt: undefined,
          _updatedAt: undefined,
          _rev: undefined,
        }

        // 重新產生 array items 的 _key
        if (newDoc.days) {
          newDoc.days = newDoc.days.map((day: any, i: number) => ({
            ...day,
            _key: `day-${i}-${Date.now()}`,
            activities: day.activities?.map((act: any, j: number) => ({
              ...act,
              _key: `act-${j}-${Date.now()}`,
            })),
          }))
        }

        if (newDoc.hotels) {
          newDoc.hotels = newDoc.hotels.map((hotel: any, i: number) => ({
            ...hotel,
            _key: `hotel-${i}-${Date.now()}`,
          }))
        }

        // 建立新文件
        await client.create(newDoc)

        toast.push({
          status: 'success',
          title: '已複製行程',
          description: `新行程：${newDoc.clientName}`,
        })

        // 導航到新文件
        router.navigateIntent('edit', { id: newId.replace('drafts.', ''), type: 'itinerary' })
      } catch (error) {
        console.error('複製失敗:', error)
        toast.push({
          status: 'error',
          title: '複製失敗',
          description: error instanceof Error ? error.message : '未知錯誤',
        })
      } finally {
        setIsDuplicating(false)
      }
    },
  }
}
