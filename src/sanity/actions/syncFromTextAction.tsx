// src/sanity/actions/syncFromTextAction.tsx
import { SyncIcon } from '@sanity/icons'
import { Button, Box, Text, Stack, Card, Flex, Badge } from '@sanity/ui'
import { useState, useCallback, useRef, useEffect } from 'react'
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

  // 使用 refs 來存儲 textarea 的值，避免 re-render 導致游標跳轉
  const basicTextRef = useRef<HTMLTextAreaElement>(null)
  const itineraryTextRef = useRef<HTMLTextAreaElement>(null)
  const quotationTextRef = useRef<HTMLTextAreaElement>(null)
  const notesTextRef = useRef<HTMLTextAreaElement>(null)

  // 初始值狀態（只在打開 dialog 時設定一次）
  const [initialBasicText, setInitialBasicText] = useState('')
  const [initialItineraryText, setInitialItineraryText] = useState('')
  const [initialQuotationText, setInitialQuotationText] = useState('')
  const [initialNotesText, setInitialNotesText] = useState('')

  // 備註預設模板
  const defaultNotesTemplate = `包含: 油費、停車費、過路費、外地住宿補貼、泰國旅遊保險
用車時間: 清邁10小時; 清萊12小時，超時再麻煩補給司機200/hr
小費看服務跟心意，不強制~ (有給的話司機跟導遊會很開心)

不包含: 門票、餐費、機票跟飯店、小費、個人花費

導遊會全程照顧大家，包含景點文化導覽、餐廳推薦點菜
我們也會全程在群組線上中文協助，幫忙預訂餐廳，協助一些意外狀況
門票費用跟餐費可以根據預算讓導遊處理
例如: 第一天換錢後先給導遊20000泰銖，交代用餐口味偏好
(如:不吃海鮮，牛肉，菜色不要太辣等等)
每一筆都會請她記錄，多退少補，這樣後續大家算錢會比較簡單跟清楚

**溫馨提醒**
1.泰國入境的規定是每人至少攜帶20000塊(每組家庭40000塊)的等值泰銖(也可以是台幣或美金)，雖然不一定會被抽查，建議還是遵守相關規定!)
2.清邁最好的巫宗雄匯率: 截至2026/1/20最新 (泰銖:台幣=1:0.98)
3.入境要填TDAC (出國3天前先填好)
https://tdac.immigration.go.th/arrival-card/#/home
4.清邁12~2月早晚溫差大，建議攜帶一件薄外套`

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

    // 備註：從現有欄位組合，或使用預設模板
    const existingNotes = doc?.travelRemarks as string | undefined
    const generatedNotes = existingNotes || defaultNotesTemplate

    // 設定初始值（這些值會在 dialog 渲染時設定到 textarea）
    setInitialBasicText(generatedBasic)
    setInitialItineraryText(generatedItinerary)
    setInitialQuotationText(generatedQuotation)
    setInitialNotesText(generatedNotes)
    setIsOpen(true)
  }, [doc, hasDays, existingDays, defaultNotesTemplate])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setIsSyncing(false)
  }, [])

  const handleSync = useCallback(() => {
    // 從 refs 取得當前值
    const basicText = basicTextRef.current?.value || ''
    const itineraryText = itineraryTextRef.current?.value || ''
    const quotationText = quotationTextRef.current?.value || ''
    const notesText = notesTextRef.current?.value || ''

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
        accommodation: day.accommodation || '',
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

      // 備註
      if (notesText.trim()) {
        updates.travelRemarks = notesText
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
  }, [year, patch, handleClose])

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
              <textarea
                ref={basicTextRef}
                defaultValue={initialBasicText}
                rows={7}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  resize: 'vertical',
                }}
              />
            </Box>

            <Box>
              <Flex align="center" gap={2} marginBottom={2}>
                <Badge tone="primary">2</Badge>
                <Text size={2} weight="semibold">行程內容</Text>
              </Flex>
              <textarea
                ref={itineraryTextRef}
                defaultValue={initialItineraryText}
                rows={20}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  resize: 'vertical',
                }}
              />
            </Box>

            <Box>
              <Flex align="center" gap={2} marginBottom={2}>
                <Badge tone="primary">3</Badge>
                <Text size={2} weight="semibold">報價明細</Text>
              </Flex>
              <textarea
                ref={quotationTextRef}
                defaultValue={initialQuotationText}
                rows={8}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  resize: 'vertical',
                }}
              />
            </Box>

            <Box>
              <Flex align="center" gap={2} marginBottom={2}>
                <Badge tone="primary">4</Badge>
                <Text size={2} weight="semibold">備註</Text>
              </Flex>
              <textarea
                ref={notesTextRef}
                defaultValue={initialNotesText}
                rows={15}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  resize: 'vertical',
                }}
              />
            </Box>

            <Flex gap={2}>
              <Button
                text={isSyncing ? '同步中...' : '同步更新'}
                tone="positive"
                onClick={handleSync}
                disabled={isSyncing}
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
