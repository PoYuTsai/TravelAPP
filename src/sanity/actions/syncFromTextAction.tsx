// src/sanity/actions/syncFromTextAction.tsx
import { SyncIcon } from '@sanity/icons'
import { Button, Box, Text, TextArea, Stack, Card, Flex, Badge } from '@sanity/ui'
import { useState, useCallback } from 'react'
import { DocumentActionProps, useDocumentOperation } from 'sanity'
import {
  parseItineraryText,
  parseBasicInfoText,
  parseQuotationText,
  sanityToLineText,
  sanityToBasicInfoText,
  sanityToQuotationText,
} from '../../lib/itinerary-parser'

export function syncFromTextAction(props: DocumentActionProps) {
  const { id, type, draft, published } = props
  const { patch } = useDocumentOperation(id, type)
  const [isOpen, setIsOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [basicText, setBasicText] = useState('')
  const [itineraryText, setItineraryText] = useState('')
  const [quotationText, setQuotationText] = useState('')

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
    // 從現有資料產生文字
    const generatedBasic = sanityToBasicInfoText({
      clientName: doc?.clientName as string,
      startDate: doc?.startDate as string,
      endDate: doc?.endDate as string,
      adults: doc?.adults as number,
      children: doc?.children as number,
      childrenAges: doc?.childrenAges as string,
      totalPeople: doc?.totalPeople as number,
      luggageNote: doc?.luggageNote as string,
      vehicleNote: doc?.vehicleNote as string,
      guideNote: doc?.guideNote as string,
    })

    const generatedItinerary = hasDays
      ? sanityToLineText({
          clientName: doc?.clientName as string,
          days: existingDays,
        })
      : ''

    const quotationItems = doc?.quotationItems as any[] | undefined
    const generatedQuotation = quotationItems?.length
      ? sanityToQuotationText(quotationItems, doc?.quotationTotal as number)
      : ''

    setBasicText(generatedBasic)
    setItineraryText(generatedItinerary)
    setQuotationText(generatedQuotation)
    setIsOpen(true)
  }, [doc, hasDays, existingDays])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setIsSyncing(false)
  }, [])

  const handleSync = useCallback(() => {
    if (!itineraryText.trim()) {
      alert('請填入行程內容')
      return
    }

    setIsSyncing(true)

    try {
      // 解析基本資訊
      const basicResult = parseBasicInfoText(basicText)
      const detectedYear = basicResult.startDate
        ? parseInt(basicResult.startDate.substring(0, 4), 10)
        : year

      // 解析行程
      const itineraryResult = parseItineraryText(itineraryText, detectedYear)

      if (!itineraryResult.success || itineraryResult.days.length === 0) {
        alert('無法解析行程文字，請檢查格式')
        setIsSyncing(false)
        return
      }

      // 解析報價
      const quotationResult = parseQuotationText(quotationText, detectedYear)

      // 轉換成 Sanity 格式
      const days = itineraryResult.days.map((day, index) => ({
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

      // 轉換報價成 Sanity 格式
      const quotationItems = quotationResult.items.map((item, index) => ({
        _key: `quot-${index}-${Date.now()}`,
        _type: 'quotationItem',
        date: item.date || null,
        description: item.description,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        unit: item.unit || '台',
      }))

      // 組合更新內容
      const updates: Record<string, any> = {
        days,
        rawItineraryText: itineraryText,
      }

      // 基本資訊
      if (basicResult.clientName) updates.clientName = basicResult.clientName
      if (basicResult.startDate) updates.startDate = basicResult.startDate
      if (basicResult.endDate) updates.endDate = basicResult.endDate
      if (basicResult.adults) updates.adults = basicResult.adults
      if (basicResult.children !== undefined) updates.children = basicResult.children
      if (basicResult.childrenAges) updates.childrenAges = basicResult.childrenAges
      if (basicResult.totalPeople) updates.totalPeople = basicResult.totalPeople
      if (basicResult.luggageNote) updates.luggageNote = basicResult.luggageNote
      if (basicResult.vehicleNote) updates.vehicleNote = basicResult.vehicleNote
      if (basicResult.guideNote) updates.guideNote = basicResult.guideNote

      // 報價
      if (quotationItems.length > 0) {
        updates.quotationItems = quotationItems
        if (quotationResult.total) updates.quotationTotal = quotationResult.total
      }

      // 同時更新日期範圍（如果基本資訊沒有的話）
      if (!updates.startDate && itineraryResult.days.length > 0) {
        updates.startDate = itineraryResult.days[0].date
        updates.endDate = itineraryResult.days[itineraryResult.days.length - 1].date
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
  }, [basicText, itineraryText, quotationText, year, patch, handleClose])

  return {
    label: '文字編輯',
    icon: SyncIcon,
    disabled: !hasDays,
    title: hasDays ? '用文字方式編輯所有資料' : '請先用「快速建立」建立行程',
    onHandle: handleOpen,
    dialog: isOpen && {
      type: 'dialog',
      header: '文字編輯',
      content: (
        <Box padding={4} style={{ maxHeight: '80vh', overflow: 'auto' }}>
          <Stack space={4}>
            <Card padding={3} tone="primary" border>
              <Text size={1}>
                直接編輯下方三個區塊，完成後點「同步更新」會重新解析並更新所有欄位。
              </Text>
            </Card>

            <Box>
              <Flex align="center" gap={2} marginBottom={2}>
                <Badge tone="primary">1</Badge>
                <Text size={2} weight="semibold">基本資訊</Text>
              </Flex>
              <TextArea
                value={basicText}
                onChange={(e) => setBasicText(e.currentTarget.value)}
                rows={7}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
            </Box>

            <Box>
              <Flex align="center" gap={2} marginBottom={2}>
                <Badge tone="primary">2</Badge>
                <Text size={2} weight="semibold">行程內容</Text>
              </Flex>
              <TextArea
                value={itineraryText}
                onChange={(e) => setItineraryText(e.currentTarget.value)}
                rows={20}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
            </Box>

            <Box>
              <Flex align="center" gap={2} marginBottom={2}>
                <Badge tone="primary">3</Badge>
                <Text size={2} weight="semibold">報價明細</Text>
              </Flex>
              <TextArea
                value={quotationText}
                onChange={(e) => setQuotationText(e.currentTarget.value)}
                rows={8}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
            </Box>

            <Flex gap={2}>
              <Button
                text={isSyncing ? '同步中...' : '同步更新'}
                tone="positive"
                onClick={handleSync}
                disabled={!itineraryText.trim() || isSyncing}
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
