// src/sanity/actions/syncFromTextAction.tsx
import { SyncIcon, HelpCircleIcon, ChevronDownIcon, ChevronUpIcon } from '@sanity/icons'
import { Button, Box, Text, Stack, Card, Flex, Badge, Tab, TabList, TabPanel } from '@sanity/ui'
import { useState, useCallback, useRef, useMemo } from 'react'
import { DocumentActionProps, useDocumentOperation } from 'sanity'
import {
  parseItineraryText,
  sanityToLineText,
  generateHotelsFromDays,
} from '../../lib/itinerary-parser'
import {
  StructuredBasicInfoForm,
  StructuredQuotationTable,
  ValidationStatus,
  validateEditor,
  documentToEditorState,
  type BasicInfo,
  type DailyQuotationItem,
  type OtherQuotationItem,
  getWeekday,
} from '../components/structured-editor'

// 從備註文字中解析「包含」和「不包含」內容
function parseIncludesExcludes(text: string): { priceIncludes: string; priceExcludes: string } {
  const lines = text.split('\n')
  let priceIncludes = ''
  let priceExcludes = ''

  let currentSection: 'includes' | 'excludes' | null = null
  const includesLines: string[] = []
  const excludesLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // 檢測「包含:」開頭（不包含「不包含」）
    if (/^包含[：:]/i.test(trimmed) && !trimmed.startsWith('不')) {
      currentSection = 'includes'
      // 取冒號後面的內容
      const content = trimmed.replace(/^包含[：:]\s*/, '').trim()
      if (content) {
        // 如果是逗號分隔，拆成多行
        content.split(/[,、，]/).forEach((item) => {
          if (item.trim()) includesLines.push(item.trim())
        })
      }
      continue
    }

    // 檢測「不包含:」開頭
    if (/^不包含[：:]/i.test(trimmed)) {
      currentSection = 'excludes'
      // 取冒號後面的內容
      const content = trimmed.replace(/^不包含[：:]\s*/, '').trim()
      if (content) {
        content.split(/[,、，]/).forEach((item) => {
          if (item.trim()) excludesLines.push(item.trim())
        })
      }
      continue
    }

    // 檢測是否進入其他區塊（用來結束當前區塊）
    if (/^(\*\*|##|導遊|用車|小費|備註|溫馨)/i.test(trimmed)) {
      currentSection = null
      continue
    }

    // 空行也結束當前區塊
    if (!trimmed) {
      currentSection = null
      continue
    }

    // 收集當前區塊的內容
    if (currentSection === 'includes' && trimmed) {
      includesLines.push(trimmed)
    } else if (currentSection === 'excludes' && trimmed) {
      excludesLines.push(trimmed)
    }
  }

  // 格式化輸出（每行一項）
  if (includesLines.length > 0) {
    priceIncludes = includesLines.map((item) => `- ${item}`).join('\n')
  }
  if (excludesLines.length > 0) {
    priceExcludes = excludesLines.map((item) => `- ${item}`).join('\n')
  }

  return { priceIncludes, priceExcludes }
}

export function syncFromTextAction(props: DocumentActionProps) {
  const { id, type, draft, published } = props
  const { patch } = useDocumentOperation(id, type)
  const [isOpen, setIsOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'itinerary' | 'quotation' | 'notes'>('basic')

  // 結構化編輯器狀態
  const [basicInfo, setBasicInfo] = useState<BasicInfo>({
    clientName: '',
    startDate: '',
    endDate: '',
    arrivalFlight: { preset: '', custom: '' },
    departureFlight: { preset: '', custom: '' },
    adults: 2,
    children: 0,
    childrenAges: '',
    guideService: { required: true, quantity: 1, days: 1 },
    childSeat: { required: false, quantity: 0, days: 0 },
    extraVehicle: { required: false, quantity: 0, days: 0 },
    vehicleCount: 1,
    vehicleType: 'van',
    luggageNote: '',
  })
  const [dailyItems, setDailyItems] = useState<DailyQuotationItem[]>([])
  const [otherItems, setOtherItems] = useState<OtherQuotationItem[]>([])

  // 使用 refs 來存儲 textarea 的值，避免 re-render 導致游標跳轉
  const itineraryTextRef = useRef<HTMLTextAreaElement>(null)
  const notesTextRef = useRef<HTMLTextAreaElement>(null)

  // 初始值狀態（只在打開 dialog 時設定一次）
  const [initialItineraryText, setInitialItineraryText] = useState('')
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

  // 計算總天數
  const totalDays = useMemo(() => {
    if (!basicInfo.startDate || !basicInfo.endDate) return 0
    const start = new Date(basicInfo.startDate)
    const end = new Date(basicInfo.endDate)
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }, [basicInfo.startDate, basicInfo.endDate])

  // 驗證狀態
  const validation = useMemo(() => {
    return validateEditor(basicInfo, otherItems)
  }, [basicInfo, otherItems])

  const handleOpen = useCallback(() => {
    // 從文件轉換成編輯器狀態
    const editorState = documentToEditorState(doc)

    setBasicInfo(editorState.basicInfo)
    setDailyItems(editorState.quotation.dailyItems)
    setOtherItems(editorState.quotation.otherItems)

    // 產生行程文字
    const generatedItinerary = hasDays
      ? sanityToLineText({
          clientName: doc?.clientName as string,
          days: existingDays,
        })
      : ''

    // 備註
    const existingNotes = doc?.travelRemarks as string | undefined
    const generatedNotes = existingNotes || defaultNotesTemplate

    setInitialItineraryText(generatedItinerary)
    setInitialNotesText(generatedNotes)
    setActiveTab('basic')
    setIsOpen(true)
  }, [doc, hasDays, existingDays, defaultNotesTemplate])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setIsSyncing(false)
  }, [])

  const handleSync = useCallback(() => {
    // 從 refs 取得當前值
    const itineraryText = itineraryTextRef.current?.value || ''
    const notesText = notesTextRef.current?.value || ''

    if (!itineraryText.trim()) {
      alert('請填入行程內容')
      setActiveTab('itinerary')
      return
    }

    // 驗證
    if (!validation.isValid) {
      alert('請修正驗證錯誤：\n' + validation.errors.join('\n'))
      return
    }

    setIsSyncing(true)

    try {
      // 取得年份
      const year = basicInfo.startDate
        ? parseInt(basicInfo.startDate.substring(0, 4), 10)
        : new Date().getFullYear()

      // 解析行程
      const itineraryResult = parseItineraryText(itineraryText, year)

      if (!itineraryResult.success || itineraryResult.days.length === 0) {
        alert('無法解析行程文字，請檢查格式')
        setIsSyncing(false)
        setActiveTab('itinerary')
        return
      }

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
      const quotationItems = [
        // 每日包車
        ...dailyItems.map((item, index) => ({
          _key: `quot-daily-${index}-${Date.now()}`,
          _type: 'quotationItem',
          date: item.date,
          description: item.description,
          unitPrice: item.price,
          quantity: 1,
          unit: '台',
        })),
        // 其他費用（保險即使 0 也保存，以保留用戶選擇）
        ...otherItems
          .filter((item) => item.unitPrice > 0 || item.type === 'insurance')
          .map((item, index) => ({
            _key: `quot-other-${index}-${Date.now()}`,
            _type: 'quotationItem',
            date: null,
            description: item.description,
            unitPrice: item.unitPrice,
            quantity: item.quantity * item.days,
            unit: item.type === 'childSeat' ? '張' : item.type === 'extraVehicle' ? '台' : item.type === 'insurance' ? '人' : '位',
          })),
      ]

      // 計算總額
      const dailyTotal = dailyItems.reduce((sum, item) => sum + item.price, 0)
      const otherTotal = otherItems.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity * item.days,
        0
      )
      const quotationTotal = dailyTotal + otherTotal

      // 組合更新內容
      const updates: Record<string, any> = {
        days,
        rawItineraryText: itineraryText,
        // 基本資訊
        clientName: basicInfo.clientName,
        startDate: basicInfo.startDate,
        endDate: basicInfo.endDate,
        adults: basicInfo.adults,
        children: basicInfo.children,
        childrenAges: basicInfo.childrenAges,
        totalPeople: basicInfo.adults + basicInfo.children,
        luggageNote: basicInfo.luggageNote,
        // 新增的結構化欄位
        arrivalFlight: basicInfo.arrivalFlight,
        departureFlight: basicInfo.departureFlight,
        guideService: basicInfo.guideService,
        childSeat: basicInfo.childSeat,
        extraVehicle: basicInfo.extraVehicle,
        vehicleCount: basicInfo.vehicleCount,
        vehicleType: basicInfo.vehicleType,
        // 報價
        quotationItems,
        quotationTotal,
      }

      // 自動產生飯店記錄
      const hotelsData = generateHotelsFromDays(
        itineraryResult.days.map((day) => ({
          date: day.date,
          accommodation: day.accommodation,
        }))
      ).map((hotel, index) => ({
        _key: `hotel-${index}-${Date.now()}`,
        _type: 'hotelBooking',
        hotelName: hotel.hotelName,
        startDate: hotel.startDate,
        endDate: hotel.endDate,
        guests: hotel.guests,
        color: hotel.color,
      }))

      if (hotelsData.length > 0) {
        updates.hotels = hotelsData
      }

      // 備註 - 同時解析「包含」和「不包含」
      if (notesText.trim()) {
        updates.travelRemarks = notesText

        // 自動解析「包含:」和「不包含:」填入 PDF 欄位
        const { priceIncludes, priceExcludes } = parseIncludesExcludes(notesText)
        if (priceIncludes) {
          updates.priceIncludes = priceIncludes
        }
        if (priceExcludes) {
          updates.priceExcludes = priceExcludes
        }
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
  }, [basicInfo, dailyItems, otherItems, validation, patch, handleClose])

  return {
    label: '結構化編輯',
    icon: SyncIcon,
    disabled: !hasDays,
    title: hasDays ? '用表單方式編輯所有資料' : '請先用「快速建立」建立行程',
    onHandle: handleOpen,
    dialog: isOpen && {
      type: 'dialog',
      header: '結構化編輯器',
      content: (
        <Box padding={4} style={{ maxHeight: '80vh', overflow: 'auto', minWidth: '700px' }}>
          <Stack space={4}>
            {/* Tab 導航 */}
            <TabList space={2}>
              <Tab
                aria-controls="basic-panel"
                id="basic-tab"
                label="1. 基本資訊"
                selected={activeTab === 'basic'}
                onClick={() => setActiveTab('basic')}
              />
              <Tab
                aria-controls="itinerary-panel"
                id="itinerary-tab"
                label="2. 行程內容"
                selected={activeTab === 'itinerary'}
                onClick={() => setActiveTab('itinerary')}
              />
              <Tab
                aria-controls="quotation-panel"
                id="quotation-tab"
                label="3. 報價明細"
                selected={activeTab === 'quotation'}
                onClick={() => setActiveTab('quotation')}
              />
              <Tab
                aria-controls="notes-panel"
                id="notes-tab"
                label="4. 備註"
                selected={activeTab === 'notes'}
                onClick={() => setActiveTab('notes')}
              />
            </TabList>

            {/* 基本資訊 Tab */}
            <TabPanel
              aria-labelledby="basic-tab"
              hidden={activeTab !== 'basic'}
              id="basic-panel"
            >
              <StructuredBasicInfoForm
                value={basicInfo}
                onChange={setBasicInfo}
                totalDays={totalDays}
              />
            </TabPanel>

            {/* 行程內容 Tab */}
            <TabPanel
              aria-labelledby="itinerary-tab"
              hidden={activeTab !== 'itinerary'}
              id="itinerary-panel"
            >
              <Stack space={3}>
                <Card
                  padding={3}
                  tone="transparent"
                  border
                  style={{ cursor: 'pointer' }}
                  onClick={() => setShowHelp(!showHelp)}
                >
                  <Flex align="center" justify="space-between">
                    <Flex align="center" gap={2}>
                      <HelpCircleIcon />
                      <Text size={1} weight="semibold">
                        編輯提示：接機/送機怎麼寫？
                      </Text>
                    </Flex>
                    {showHelp ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </Flex>
                  {showHelp && (
                    <Box marginTop={3} style={{ fontSize: '12px', lineHeight: '1.6' }}>
                      <Text size={1} style={{ marginBottom: '8px' }}>
                        <strong>
                          口訣：抵達後能吃什麼就寫什麼，起飛前能吃什麼就寫什麼，沒寫的 PDF 自動隱藏
                        </strong>
                      </Text>
                      <Box
                        marginTop={2}
                        style={{
                          background: '#f5f5f5',
                          padding: '8px',
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                        }}
                      >
                        <div>
                          <strong>接機日 (Day 1)</strong>
                        </div>
                        <div>- 早班 10:30 抵達 → 寫午餐、晚餐、住宿</div>
                        <div>- 午班 16:20 抵達 → 跳過午餐，寫晚餐、住宿</div>
                        <div>- 晚班 21:45 抵達 → 只寫住宿</div>
                        <div style={{ marginTop: '8px' }}>
                          <strong>送機日 (最後一天)</strong>
                        </div>
                        <div>- 早班 11:20 起飛 → 不寫午餐/晚餐/住宿</div>
                        <div>- 午班 17:20 起飛 → 可寫午餐</div>
                        <div>- 紅眼 01:40 起飛 → 寫午餐、晚餐</div>
                      </Box>
                    </Box>
                  )}
                </Card>

                <textarea
                  ref={itineraryTextRef}
                  defaultValue={initialItineraryText}
                  rows={25}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    resize: 'vertical',
                    lineHeight: '1.6',
                  }}
                />
              </Stack>
            </TabPanel>

            {/* 報價明細 Tab */}
            <TabPanel
              aria-labelledby="quotation-tab"
              hidden={activeTab !== 'quotation'}
              id="quotation-panel"
            >
              <StructuredQuotationTable
                basicInfo={basicInfo}
                dailyItems={dailyItems}
                otherItems={otherItems}
                onDailyItemsChange={setDailyItems}
                onOtherItemsChange={setOtherItems}
              />
            </TabPanel>

            {/* 備註 Tab */}
            <TabPanel
              aria-labelledby="notes-tab"
              hidden={activeTab !== 'notes'}
              id="notes-panel"
            >
              <textarea
                ref={notesTextRef}
                defaultValue={initialNotesText}
                rows={20}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  resize: 'vertical',
                  lineHeight: '1.6',
                }}
              />
            </TabPanel>

            {/* 驗證狀態 */}
            <ValidationStatus basicInfo={basicInfo} otherItems={otherItems} />

            {/* 操作按鈕 */}
            <Flex gap={2}>
              <Button
                text={isSyncing ? '同步中...' : '同步更新'}
                tone="positive"
                onClick={handleSync}
                disabled={isSyncing || !validation.isValid}
              />
              <Button text="取消" mode="ghost" onClick={handleClose} />
            </Flex>
          </Stack>
        </Box>
      ),
      onClose: handleClose,
    },
  }
}
