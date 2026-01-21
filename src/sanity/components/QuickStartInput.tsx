// src/sanity/components/QuickStartInput.tsx
// 在新文件時顯示快速建立按鈕，點擊直接開啟對話框
import { Card, Stack, Text, Box, Button, Dialog, TextArea, Flex, Badge } from '@sanity/ui'
import { AddIcon, CheckmarkIcon } from '@sanity/icons'
import { useFormValue, useDocumentOperation, useClient } from 'sanity'
import { useState, useCallback } from 'react'
import { parseBasicInfoText, parseItineraryText, parseQuotationText } from '../../lib/itinerary-parser'

// 範例模板
const BASIC_INFO_TEMPLATE = `客戶姓名: 巧玲(KAI &MINNIE 媽)
日期: 2026/2/12~2/18
人數: 5人
成人3 (1長者) 小朋友2 (國中生*2)
行李: 1台車大約可以放6~7顆28~30吋
包車: 1台(10人座大車)
導遊: 中英泰導遊 1位`

const ITINERARY_TEMPLATE = `2/12 (四)
Day 1｜抵達清邁・放鬆展開旅程
・機場接機 (CI851 7:20-10:35)
・巫宗雄換匯
午餐：Neng earthn jar roast pork (外帶一份)
・泰服拍攝體驗
・下午茶: 順路去買 阿嬤芒果糯米飯
按摩推薦: (Peak Spa & Beauty Salon)
・夜間動物園
晚餐: 黑森林餐廳
・住宿

2/13 (五)
Day 2｜湄康蓬村一日
・Teen Tok Royal Project
・湄康蓬村 Mae Kampong Village
・Mae Kampong Waterfall
・村內咖啡館Lung Pud Pa Peng Coffee
午餐: Thanthong restaurant
・可可果園Skugga Estate
・清邁大學夜市
・住宿

2/14 (六)
Day 3｜湄林一日
・老虎王國
・Alpaca Sheep Farm Mon Jam (蒙占山綿羊)
午餐：Fleur Cafe & Eatery
・phoenix adventure park
・豬豬農場
晚餐：River View Bar
・住宿

2/15 (日)
Day 4｜市集一日(周末限定)
・真心市集
・椰林市集
午餐: The Chef
・下午茶: 100種冰淇淋
・藝術村 Baan Kang Wat
・瓦洛落市場
晚餐：Sai Ping Bar & Restaurant
・住宿

2/16 (一)
Day 5｜清萊一日
・溫泉廣場休息站
・白廟
午餐: 仙境咖啡廳
・長頸村
回程
晚餐: CHUM Northern Kitchen @Old City
・住宿

2/17 (二)
Day 6｜湄登一日
・大象保護營
午餐：營區道地泰式
・天使瀑布Dantewada
・清邁藍廟 Wat Den Sali Sri Muang Kaen
・Maya百貨
・One 尼曼市集
晚餐: Ekachan The Wisdom of Ethnic Thai Cuisine
・住宿

2/18 (三)
Day 7｜收心慢遊・送機回國
・早餐後退房
・9:30送機
・安排送機服務(11:50-16:30)`

const QUOTATION_TEMPLATE = `2/12 接機+市區 3200
2/13 湄康蓬 3800
2/14 湄林 3800
2/15 市區 3500
2/16 清萊 4500
2/17 湄登 3800
2/18 送機 600
導遊 2500*6天
保險 500
小計: 38700`

export function QuickStartInput(props: any) {
  const { id, type } = props.document || {}
  const [isOpen, setIsOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [basicText, setBasicText] = useState(BASIC_INFO_TEMPLATE)
  const [itineraryText, setItineraryText] = useState(ITINERARY_TEMPLATE)
  const [quotationText, setQuotationText] = useState(QUOTATION_TEMPLATE)
  const [preview, setPreview] = useState<any>(null)

  const client = useClient({ apiVersion: '2024-01-01' })

  // 取得文件的 clientName 和 days
  const clientName = useFormValue(['clientName']) as string | undefined
  const days = useFormValue(['days']) as any[] | undefined
  const documentId = useFormValue(['_id']) as string | undefined

  // 檢查是否為新文件
  const isNewDocument = !clientName && (!days || days.length === 0)

  const handlePreview = useCallback(() => {
    const basicResult = parseBasicInfoText(basicText)
    const year = basicResult.startDate ? parseInt(basicResult.startDate.substring(0, 4), 10) : new Date().getFullYear()
    const itineraryResult = parseItineraryText(itineraryText, year)
    const quotationResult = parseQuotationText(quotationText, year)
    setPreview({ basic: basicResult, itinerary: itineraryResult, quotation: quotationResult })
  }, [basicText, itineraryText, quotationText])

  const handleImport = useCallback(async () => {
    if (!documentId) return
    setIsProcessing(true)

    try {
      const basicResult = parseBasicInfoText(basicText)
      const year = basicResult.startDate ? parseInt(basicResult.startDate.substring(0, 4), 10) : new Date().getFullYear()
      const itineraryResult = parseItineraryText(itineraryText, year)
      const quotationResult = parseQuotationText(quotationText, year)

      // 轉換行程成 Sanity 格式
      const daysData = itineraryResult.days.map((day, index) => ({
        _key: `day-${day.date}-${Date.now()}-${index}`,
        _type: 'dayItem',
        date: day.date,
        title: day.title || `第 ${day.dayNumber} 天`,
        morning: day.morning || '',
        afternoon: day.afternoon || '',
        evening: day.evening || '',
        lunch: day.lunch || '',
        dinner: day.dinner || '',
        // PDF 用的詳細活動列表
        activities: day.activities?.map((act, actIndex) => ({
          _key: `act-${index}-${actIndex}-${Date.now()}`,
          _type: 'activity',
          time: act.time || '',
          content: act.content,
        })) || [],
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

      // 組合完整文件
      const doc: Record<string, any> = {
        _id: documentId,
        _type: 'itinerary',
      }
      if (basicResult.clientName) doc.clientName = basicResult.clientName
      if (basicResult.startDate) doc.startDate = basicResult.startDate
      if (basicResult.endDate) doc.endDate = basicResult.endDate
      if (basicResult.adults) doc.adults = basicResult.adults
      if (basicResult.children !== undefined) doc.children = basicResult.children
      if (basicResult.childrenAges) doc.childrenAges = basicResult.childrenAges
      if (basicResult.groupType) doc.groupType = basicResult.groupType
      if (basicResult.totalPeople) doc.totalPeople = basicResult.totalPeople
      if (basicResult.luggageNote) doc.luggageNote = basicResult.luggageNote
      if (basicResult.vehicleNote) doc.vehicleNote = basicResult.vehicleNote
      if (basicResult.guideNote) doc.guideNote = basicResult.guideNote
      if (daysData.length > 0) {
        doc.days = daysData
        doc.rawItineraryText = itineraryText
      }
      if (quotationItems.length > 0) {
        doc.quotationItems = quotationItems
        if (quotationResult.total) doc.quotationTotal = quotationResult.total
      }

      // 使用 createOrReplace 處理新文件
      await client.createOrReplace(doc as any)

      setIsOpen(false)
      setIsProcessing(false)
      // 重新整理頁面以顯示新資料
      window.location.reload()
    } catch (error) {
      console.error('匯入失敗:', error)
      alert(`匯入失敗: ${error instanceof Error ? error.message : '請檢查資料格式'}`)
      setIsProcessing(false)
    }
  }, [basicText, itineraryText, quotationText, documentId, client])

  if (!isNewDocument) {
    return null
  }

  return (
    <>
      <Card
        padding={4}
        radius={2}
        shadow={2}
        marginBottom={4}
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onClick={() => setIsOpen(true)}
      >
        <Stack space={2}>
          <Box style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AddIcon style={{ width: '28px', height: '28px', color: 'white' }} />
            <Text size={4} weight="bold" style={{ color: 'white' }}>
              點我快速建立行程
            </Text>
          </Box>
          <Text size={1} style={{ color: 'rgba(255,255,255,0.8)', marginLeft: '40px' }}>
            貼上文字，自動填入所有欄位
          </Text>
        </Stack>
      </Card>

      {isOpen && (
        <Dialog
          id="quick-create-dialog"
          header="快速建立行程"
          width={2}
          onClose={() => setIsOpen(false)}
          zOffset={1000}
        >
          <Box padding={4} style={{ maxHeight: '70vh', overflow: 'auto' }}>
            <Stack space={4}>
              <Card padding={3} tone="primary" border>
                <Text size={1}>
                  填寫以下三個區塊，點「預覽」確認後「確認匯入」
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
                  rows={15}
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
                  rows={6}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
              </Box>

              <Flex gap={2}>
                <Button text="預覽解析結果" tone="primary" onClick={handlePreview} />
                <Button text="取消" mode="ghost" onClick={() => setIsOpen(false)} />
              </Flex>

              {preview && (
                <Card padding={3} border tone="positive">
                  <Stack space={2}>
                    <Text size={1} weight="semibold">
                      解析結果：{preview.basic?.clientName || '(無客戶名)'} · {preview.itinerary?.days?.length || 0} 天 · {preview.quotation?.items?.length || 0} 項報價
                    </Text>
                    <Button
                      text={isProcessing ? '匯入中...' : '確認匯入'}
                      tone="positive"
                      icon={CheckmarkIcon}
                      onClick={handleImport}
                      disabled={isProcessing}
                    />
                  </Stack>
                </Card>
              )}
            </Stack>
          </Box>
        </Dialog>
      )}
    </>
  )
}
