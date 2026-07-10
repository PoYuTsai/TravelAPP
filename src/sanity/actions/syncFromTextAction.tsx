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
  alignLegacyBasicInfoFleet,
  getWeekday,
} from '../components/structured-editor'
import { ErrorBoundary } from '../components/ErrorBoundary'
import {
  buildLegacyOtherQuotationItems,
  resolveLegacyDailyQuotationItems,
} from '../components/structured-editor/StructuredQuotationTable'
import {
  CHILD_SEAT_FEE_PER_DAY,
  GUIDE_FEE_PER_DAY,
  INSURANCE_FEE_PER_PERSON,
  resolveFleet,
} from '@/lib/pricing/perPersonRates'
import { CHARTER_OVERTIME_POLICY } from '@/lib/pricing/publicPolicy'

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

export const resolveLegacyPublicFleet = resolveFleet

const LEGACY_ITINERARY_POLICY_BLOCK = `【固定服務政策】
標準服務為泰國司機；中文導遊為選配，未選配時不含導遊服務。
中文導遊選配價為 THB ${GUIDE_FEE_PER_DAY.toLocaleString('en-US')}／日。
用車時間：清邁 ${CHARTER_OVERTIME_POLICY.chiangMaiHours} 小時；清萊／金三角 ${CHARTER_OVERTIME_POLICY.chiangRaiGoldenTriangleHours} 小時。基本用車時間用完後，另有 ${CHARTER_OVERTIME_POLICY.graceMinutes} 分鐘彈性，超過後 THB ${CHARTER_OVERTIME_POLICY.feeThbPerHourPerCar}／小時／車；中文導遊不另計超時費。
兒童安全座椅為 THB ${CHILD_SEAT_FEE_PER_DAY}／日／張，安裝於該孩童的乘客座位，不另加算一位。
旅遊保險為選配：THB ${INSURANCE_FEE_PER_PERSON}／人／趟；未選配時不列入報價。`

export const LEGACY_ITINERARY_DEFAULT_NOTES = `包含: 泰國司機包車服務、油費、停車費、過路費

不包含: 門票、餐費、機票、飯店、小費、個人花費

${LEGACY_ITINERARY_POLICY_BLOCK}`

interface LegacyOptionalServices {
  withGuide: boolean
  withInsurance: boolean
}

function parsePolicyList(value: string): string[] {
  return value
    .split('\n')
    .map((line) =>
      line
        .replace(/^(?:[-•]\s*)+/, '')
        .replace(/^[（(]+|[）)]+$/g, '')
        .trim(),
    )
    .filter(Boolean)
}

function formatPolicyList(items: string[]): string {
  return [...new Set(items)].map((item) => `- ${item}`).join('\n')
}

function isLegacyOptionalOrVehicleClaim(item: string): boolean {
  return /導遊|保險|7\s*人座|休旅|SUV|中文司機|小車|小轎車|大車|麵包車|Van/i.test(item)
}

export function alignLegacyIncludesExcludes(
  parsed: { priceIncludes: string; priceExcludes: string },
  options: LegacyOptionalServices,
): { priceIncludes: string; priceExcludes: string } {
  const includes = parsePolicyList(parsed.priceIncludes).filter(
    (item) => !isLegacyOptionalOrVehicleClaim(item) && item !== '泰國司機包車服務',
  )
  const excludes = parsePolicyList(parsed.priceExcludes).filter(
    (item) => !/導遊|保險/i.test(item),
  )

  const alignedIncludes = [
    '泰國司機包車服務',
    '油費',
    '過路費',
    '停車費',
    'LINE 中文支援',
    ...includes,
  ]
  if (options.withGuide) alignedIncludes.push('中文導遊服務（選配）')
  if (options.withInsurance) alignedIncludes.push('旅遊保險（選配）')
  if (!options.withGuide) excludes.push('中文導遊服務（未選配）')
  if (!options.withInsurance) excludes.push('旅遊保險（未選配）')

  return {
    priceIncludes: formatPolicyList(alignedIncludes),
    priceExcludes: formatPolicyList(excludes),
  }
}

export function alignLegacyTravelNotes(
  value: string,
  options: LegacyOptionalServices,
): string {
  const source = value.trim() || LEGACY_ITINERARY_DEFAULT_NOTES
  const alignedLists = alignLegacyIncludesExcludes(
    parseIncludesExcludes(source),
    options,
  )
  let insidePriceList = false
  const withoutPriceLists = source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim()
      if (/^(?:包含|不包含)[：:]/.test(trimmed)) {
        insidePriceList = true
        return false
      }
      if (insidePriceList && !trimmed) {
        insidePriceList = false
        return false
      }
      if (insidePriceList && /^[-•]/.test(trimmed)) return false
      insidePriceList = false
      return true
    })

  const preserved = withoutPriceLists
    .map((line) =>
      line
        .replace(/(?:、|，|,)?\s*泰國旅遊保險/g, '')
        .replace(/7\s*人座休旅車|SUV\s*休旅車/gi, '泰國司機包車服務'),
    )
    .filter((line) => {
      const trimmed = line.trim()
      if (/【固定服務政策】/.test(line)) return false
      if (/用車時間|超時.*(?:司機|導遊)|標準服務為泰國司機/.test(line)) return false
      if (/中文導遊選配價為\s*THB|兒童安全座椅為\s*THB|旅遊保險為選配/.test(line)) return false
      if (/^本次旅遊保險：/.test(trimmed)) return false
      if (/NT\$|\bTWD\b/i.test(line)) return false
      const hasMoney = /THB|泰銖|฿|\d/.test(line)
      const hasExplicitPriceRate = /(?:(?:THB|฿)\s*[\d,.]+\s*(?:泰銖)?\s*(?:[／/]\s*(?:日|天|人|張|小時|hr)|每\s*(?:日|天|人|張|小時))|[\d,.]+\s*泰銖\s*(?:[／/]\s*(?:日|天|人|張|小時|hr)|每\s*(?:日|天|人|張|小時))|[\d,.]+\s*[／/]\s*(?:日|天|人|張|小時|hr))/i.test(line)
      const namesFixedService = /(?:中文)?導遊|(?:旅遊)?保險|(?:兒童|嬰兒)?(?:安全)?座椅/.test(line)
      if (
        hasMoney &&
        /(?:導遊(?:費|服務費)|保險(?:費|費用|價格)|(?:兒童|嬰兒)(?:安全)?座椅(?:費|費用|價格))/.test(line)
      ) return false
      if (hasExplicitPriceRate && namesFixedService) return false
      if (hasMoney && /(?:超時|逾時)(?:費|費用|價格)?/.test(line)) return false
      if (!options.withGuide && /導遊/.test(line)) return false
      return true
    })
    .join('\n')
    .trim()

  const priceLists = `包含:\n${alignedLists.priceIncludes}\n\n不包含:\n${alignedLists.priceExcludes}`
  const selectionStatus = `本次旅遊保險：${options.withInsurance ? '已選配' : '未選配'}。`
  return [priceLists, preserved, LEGACY_ITINERARY_POLICY_BLOCK, selectionStatus]
    .filter(Boolean)
    .join('\n\n')
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
    infants: 0,
    childrenAges: '',
    guideService: { required: false, quantity: 1, days: 1 },
    childSeat: { required: false, quantity: 0, days: 0 },
    extraVehicle: { required: false, quantity: 0, days: 0 },
    vehicleCount: 1,
    vehicleType: 'sedan',
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

  const resolvedOtherItems = useMemo(
    () => buildLegacyOtherQuotationItems(basicInfo, otherItems),
    [basicInfo, otherItems],
  )
  const resolvedDailyItems = useMemo(
    () => resolveLegacyDailyQuotationItems(basicInfo, dailyItems),
    [basicInfo, dailyItems],
  )

  const handleBasicInfoChange = useCallback((next: BasicInfo) => {
    setBasicInfo(alignLegacyBasicInfoFleet(next))
  }, [])

  // 驗證狀態
  const validation = useMemo(() => {
    return validateEditor(basicInfo, resolvedOtherItems)
  }, [basicInfo, resolvedOtherItems])

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
    const generatedNotes = alignLegacyTravelNotes(existingNotes || '', {
      withGuide: editorState.basicInfo.guideService.required,
      withInsurance: editorState.quotation.otherItems.some((item) => item.type === 'insurance'),
    })

    setInitialItineraryText(generatedItinerary)
    setInitialNotesText(generatedNotes)
    setActiveTab('basic')
    setIsOpen(true)
  }, [doc, hasDays, existingDays])

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

      const occupiedSeats = basicInfo.adults + basicInfo.children + basicInfo.infants
      if (occupiedSeats < 2) {
        throw new Error('自動報價至少需要 2 位旅客；1 位旅客請人工確認。')
      }
      const fleet = resolveLegacyPublicFleet(occupiedSeats)
      if (fleet.manualQuoteRequired) {
        throw new Error('19 人以上需人工報價，這條舊報價路徑不會產生自動總價。')
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
      const vehicleCount = fleet.carCount
      const quotationItems = [
        // 每日包車（數量 = 包車台數）
        ...resolvedDailyItems.map((item, index) => ({
          _key: `quot-daily-${index}-${Date.now()}`,
          _type: 'quotationItem',
          date: item.date,
          description: item.description,
          unitPrice: item.price,
          quantity: vehicleCount,
          unit: '台',
        })),
        // 其他費用；保險只在明確選配後才會出現在 resolvedOtherItems。
        ...resolvedOtherItems
          .filter((item) => item.unitPrice > 0)
          .map((item, index) => {
            // 確保 description 有值（schema 要求 required）
            const descriptionMap: Record<string, string> = {
              guide: '中文導遊（選配）',
              childSeat: '兒童安全座椅',
              extraVehicle: '額外行李車（人工確認）',
              insurance: '旅遊保險（選配）',
              outOfTownStay: '外地住宿補貼',
            }
            return {
              _key: `quot-other-${index}-${Date.now()}`,
              _type: 'quotationItem',
              date: null,
              description: item.description || descriptionMap[item.type] || '其他費用',
              unitPrice: item.unitPrice,
              quantity: item.quantity * item.days,
              unit: item.type === 'childSeat' ? '張' : item.type === 'extraVehicle' ? '台' : item.type === 'insurance' ? '人' : '位',
            }
          }),
      ]

      // 計算總額（每日包車 x 台數）
      const dailyTotal = resolvedDailyItems.reduce(
        (sum, item) => sum + item.price * vehicleCount,
        0,
      )
      const otherTotal = resolvedOtherItems.reduce(
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
        infants: basicInfo.infants,
        childrenAges: basicInfo.childrenAges,
        totalPeople: occupiedSeats,
        luggageNote: basicInfo.luggageNote,
        // 新增的結構化欄位
        arrivalFlight: basicInfo.arrivalFlight,
        departureFlight: basicInfo.departureFlight,
        guideService: basicInfo.guideService,
        childSeat: basicInfo.childSeat,
        extraVehicle: basicInfo.extraVehicle,
        vehicleCount: fleet.carCount,
        vehicleType: fleet.vehicle,
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

      // 備註與 PDF 欄位都經過同一份固定政策校準，避免舊文字重新帶出過時費率。
      const optionalServices = {
        withGuide: basicInfo.guideService.required,
        withInsurance: resolvedOtherItems.some((item) => item.type === 'insurance'),
      }
      const alignedNotes = alignLegacyTravelNotes(notesText, optionalServices)
      updates.travelRemarks = alignedNotes

      const alignedLists = alignLegacyIncludesExcludes(
        parseIncludesExcludes(alignedNotes),
        optionalServices,
      )
      updates.priceIncludes = alignedLists.priceIncludes
      updates.priceExcludes = alignedLists.priceExcludes

      // 執行更新（Sanity patch 是非同步的）
      try {
        patch.execute([{ set: updates }])
      } catch (patchError) {
        console.error('Patch 執行失敗:', patchError)
        throw patchError
      }

      setTimeout(() => {
        setIsSyncing(false)
        handleClose()
      }, 300)
    } catch (error) {
      console.error('同步失敗:', error)
      alert('同步失敗：' + (error instanceof Error ? error.message : '請檢查文字格式'))
      setIsSyncing(false)
    }
  }, [basicInfo, resolvedDailyItems, resolvedOtherItems, validation, patch, handleClose])

  return {
    label: '結構化編輯',
    icon: SyncIcon,
    disabled: !hasDays,
    title: hasDays ? '用表單方式編輯所有資料' : '請先用「快速建立」建立行程',
    onHandle: handleOpen,
    dialog: isOpen && {
      type: 'dialog' as const,
      header: '結構化編輯器',
      content: (
        <ErrorBoundary fallbackMessage="結構化編輯器載入失敗">
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
                onChange={handleBasicInfoChange}
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
                dailyItems={resolvedDailyItems}
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
            <ValidationStatus basicInfo={basicInfo} otherItems={resolvedOtherItems} />

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
        </ErrorBoundary>
      ),
      onClose: handleClose,
    },
  }
}
