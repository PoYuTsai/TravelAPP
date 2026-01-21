// src/sanity/actions/generateDaysAction.tsx
import { CalendarIcon } from '@sanity/icons'
import { useToast } from '@sanity/ui'
import { useState } from 'react'
import { DocumentActionProps, useDocumentOperation } from 'sanity'

export function generateDaysAction(props: DocumentActionProps) {
  const { id, type, published, draft } = props
  const { patch } = useDocumentOperation(id, type)
  const toast = useToast()
  const [isGenerating, setIsGenerating] = useState(false)

  // 只在 itinerary 類型顯示
  if (type !== 'itinerary') return null

  const doc = draft || published
  if (!doc) return null

  const startDate = doc.startDate as string | undefined
  const endDate = doc.endDate as string | undefined
  const existingDays = (doc.days as any[]) || []

  // 檢查是否可以產生
  const canGenerate = startDate && endDate && startDate <= endDate

  return {
    label: isGenerating ? '產生中...' : '自動產生天數',
    icon: CalendarIcon,
    disabled: isGenerating || !canGenerate,
    title: !canGenerate ? '請先設定出發日期和結束日期' : undefined,
    onHandle: async () => {
      if (!startDate || !endDate) return

      setIsGenerating(true)

      try {
        // 計算需要的天數
        const start = new Date(startDate)
        const end = new Date(endDate)
        const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

        if (totalDays <= 0 || totalDays > 30) {
          toast.push({
            status: 'error',
            title: '日期範圍無效',
            description: '請確認出發日期早於結束日期，且不超過 30 天',
          })
          return
        }

        // 取得現有的日期
        const existingDates = new Set(existingDays.map((d: any) => d.date))

        // 產生新的天數（只補缺少的）
        const newDays: any[] = [...existingDays]
        let addedCount = 0

        for (let i = 0; i < totalDays; i++) {
          const date = new Date(start)
          date.setDate(date.getDate() + i)
          const dateStr = date.toISOString().split('T')[0]

          if (!existingDates.has(dateStr)) {
            // 產生預設標題
            let title = `第 ${i + 1} 天`
            if (i === 0) title = '出發日'
            else if (i === totalDays - 1) title = '返程日'

            newDays.push({
              _key: `day-${dateStr}-${Date.now()}`,
              _type: 'dayItem',
              date: dateStr,
              title,
              morning: '',
              afternoon: '',
              evening: '',
            })
            addedCount++
          }
        }

        // 按日期排序
        newDays.sort((a, b) => (a.date || '').localeCompare(b.date || ''))

        // 更新文件
        patch.execute([{ set: { days: newDays } }])

        toast.push({
          status: 'success',
          title: '已產生每日行程',
          description: addedCount > 0
            ? `新增 ${addedCount} 天，共 ${newDays.length} 天`
            : `已有完整 ${newDays.length} 天，無需新增`,
        })
      } catch (error) {
        console.error('產生失敗:', error)
        toast.push({
          status: 'error',
          title: '產生失敗',
          description: error instanceof Error ? error.message : '未知錯誤',
        })
      } finally {
        setIsGenerating(false)
      }
    },
  }
}
