// src/sanity/actions/syncFromTextAction.tsx
import { SyncIcon } from '@sanity/icons'
import { Button, Box, Text, TextArea, Stack, Card, Flex } from '@sanity/ui'
import { useState, useCallback } from 'react'
import { DocumentActionProps, useDocumentOperation } from 'sanity'
import { parseItineraryText, sanityToLineText } from '../../lib/itinerary-parser'

export function syncFromTextAction(props: DocumentActionProps) {
  const { id, type, draft, published } = props
  const { patch } = useDocumentOperation(id, type)
  const [isOpen, setIsOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [editText, setEditText] = useState('')

  // 只在 itinerary 類型顯示
  if (type !== 'itinerary') return null

  // 取得當前文件資料
  const doc = draft || published

  // 檢查是否有現有行程
  const existingDays = doc?.days as any[] | undefined
  const hasDays = existingDays && existingDays.length > 0

  // 取得年份（從 startDate 或當前年份）
  const startDate = doc?.startDate as string | undefined
  const year = startDate ? parseInt(startDate.substring(0, 4), 10) : new Date().getFullYear()

  const handleOpen = useCallback(() => {
    // 從現有行程產生文字
    let generatedText = ''
    if (hasDays) {
      generatedText = sanityToLineText({
        clientName: doc?.clientName as string,
        days: existingDays,
      })
    }
    setEditText(generatedText)
    setIsOpen(true)
  }, [hasDays, existingDays, doc?.clientName])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setIsSyncing(false)
  }, [])

  const handleSync = useCallback(() => {
    if (!editText.trim()) {
      alert('請填入行程內容')
      return
    }

    setIsSyncing(true)

    try {
      // 解析文字
      const result = parseItineraryText(editText, year)

      if (!result.success || result.days.length === 0) {
        alert('無法解析行程文字，請檢查格式')
        setIsSyncing(false)
        return
      }

      // 轉換成 Sanity 格式
      const days = result.days.map((day, index) => ({
        _key: `day-${day.date}-${Date.now()}-${index}`,
        _type: 'dayItem',
        date: day.date,
        title: day.title || `第 ${day.dayNumber} 天`,
        morning: day.morning || '',
        afternoon: day.afternoon || '',
        evening: day.evening || '',
        lunch: day.lunch || '',
        dinner: day.dinner || '',
        activities: day.activities.map((act, i) => ({
          _key: `act-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          _type: 'activity',
          content: act.content,
          time: act.time || '',
        })),
      }))

      // 更新文件（包含 rawItineraryText）
      const updates: Record<string, any> = {
        days,
        rawItineraryText: editText,
      }

      // 同時更新日期範圍
      if (result.days.length > 0) {
        const firstDate = result.days[0].date
        const lastDate = result.days[result.days.length - 1].date
        updates.startDate = firstDate
        updates.endDate = lastDate
      }

      patch.execute([{ set: updates }])

      setTimeout(() => {
        setIsSyncing(false)
        handleClose()
      }, 300)
    } catch (error) {
      console.error('同步失敗:', error)
      alert('同步失敗，請檢查文字格式')
      setIsSyncing(false)
    }
  }, [editText, year, patch, handleClose])

  return {
    label: '編輯行程文字',
    icon: SyncIcon,
    disabled: !hasDays,
    title: hasDays ? '編輯行程文字並同步更新' : '請先用「快速建立」建立行程',
    onHandle: handleOpen,
    dialog: isOpen && {
      type: 'dialog',
      header: '編輯行程文字',
      content: (
        <Box padding={4}>
          <Stack space={4}>
            <Card padding={3} tone="primary" border>
              <Text size={1}>
                直接編輯下方文字，完成後點「同步更新」會重新解析並更新每日行程。
              </Text>
            </Card>

            <TextArea
              value={editText}
              onChange={(e) => setEditText(e.currentTarget.value)}
              rows={25}
              style={{ fontFamily: 'monospace', fontSize: '13px' }}
            />

            <Flex gap={2}>
              <Button
                text={isSyncing ? '同步中...' : '同步更新'}
                tone="positive"
                onClick={handleSync}
                disabled={!editText.trim() || isSyncing}
              />
              <Button
                text="取消"
                mode="ghost"
                onClick={handleClose}
              />
            </Flex>
          </Stack>
        </Box>
      ),
      onClose: handleClose,
    },
  }
}
