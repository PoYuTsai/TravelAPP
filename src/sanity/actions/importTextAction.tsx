// src/sanity/actions/importTextAction.tsx
import { UploadIcon } from '@sanity/icons'
import { Button, Dialog, Box, Text, TextArea, Stack, Card, Flex, Badge } from '@sanity/ui'
import { useState, useCallback } from 'react'
import { DocumentActionProps, useDocumentOperation } from 'sanity'
import { parseItineraryText } from '../../lib/itinerary-parser'

export function importTextAction(props: DocumentActionProps) {
  const { id, type, draft, published } = props
  const { patch } = useDocumentOperation(id, type)
  const [isOpen, setIsOpen] = useState(false)
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<ReturnType<typeof parseItineraryText> | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())

  // 只在 itinerary 類型顯示
  if (type !== 'itinerary') return null

  const handleOpen = useCallback(() => {
    setIsOpen(true)
    setText('')
    setPreview(null)
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setText('')
    setPreview(null)
  }, [])

  const handlePreview = useCallback(() => {
    const result = parseItineraryText(text, year)
    setPreview(result)
  }, [text, year])

  const handleImport = useCallback(() => {
    if (!preview || !preview.success) return

    // 轉換成 Sanity 格式
    const days = preview.days.map((day, index) => ({
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
        _key: `act-${i}-${Date.now()}`,
        _type: 'activity',
        content: act.content,
        time: act.time || '',
      })),
    }))

    // 更新文件
    const firstDate = preview.days[0]?.date
    const lastDate = preview.days[preview.days.length - 1]?.date

    patch.execute([
      {
        set: {
          days,
          ...(firstDate && { startDate: firstDate }),
          ...(lastDate && { endDate: lastDate }),
        },
      },
    ])

    handleClose()
  }, [preview, patch, handleClose])

  return {
    label: '匯入文字',
    icon: UploadIcon,
    onHandle: handleOpen,
    dialog: isOpen && {
      type: 'dialog',
      header: '匯入行程文字',
      content: (
        <Box padding={4}>
          <Stack space={4}>
            <Card padding={3} tone="primary" border>
              <Text size={1}>
                貼上你的行程文字，格式範例：
              </Text>
              <Box marginTop={2}>
                <Text size={1} muted>
                  {`2/1 (日)`}<br />
                  {`Day 1｜抵達清邁`}<br />
                  {`・機場接機`}<br />
                  {`午餐：xxx`}<br />
                  {`・下午活動`}<br />
                  {`晚餐：xxx`}<br />
                  {`・夜間活動`}
                </Text>
              </Box>
            </Card>

            <Box>
              <Text size={1} weight="semibold">年份</Text>
              <Box marginTop={2}>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10))}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    width: '100px',
                  }}
                />
              </Box>
            </Box>

            <Box>
              <Text size={1} weight="semibold">貼上行程文字</Text>
              <Box marginTop={2}>
                <TextArea
                  value={text}
                  onChange={(e) => setText(e.currentTarget.value)}
                  rows={12}
                  placeholder="在此貼上你的行程文字..."
                  style={{ fontFamily: 'monospace' }}
                />
              </Box>
            </Box>

            <Flex gap={2}>
              <Button
                text="預覽解析結果"
                tone="primary"
                onClick={handlePreview}
                disabled={!text.trim()}
              />
              <Button
                text="取消"
                mode="ghost"
                onClick={handleClose}
              />
            </Flex>

            {preview && (
              <Card padding={3} border tone={preview.success ? 'positive' : 'critical'}>
                <Stack space={3}>
                  <Flex align="center" gap={2}>
                    <Badge tone={preview.success ? 'positive' : 'critical'}>
                      {preview.success ? '解析成功' : '解析失敗'}
                    </Badge>
                    <Text size={1}>
                      共 {preview.days.length} 天
                    </Text>
                  </Flex>

                  {preview.days.length > 0 && (
                    <Box>
                      <Text size={1} weight="semibold">解析結果預覽：</Text>
                      <Box
                        marginTop={2}
                        style={{
                          maxHeight: '200px',
                          overflow: 'auto',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          background: '#f5f5f5',
                          padding: '8px',
                          borderRadius: '4px',
                        }}
                      >
                        {preview.days.map((day, i) => (
                          <Box key={i} marginBottom={2}>
                            <Text size={1} weight="semibold">
                              {day.date} - {day.title}
                            </Text>
                            <Text size={1} muted>
                              早: {day.morning?.substring(0, 30) || '(空)'}...
                            </Text>
                            <Text size={1} muted>
                              午: {day.afternoon?.substring(0, 30) || '(空)'}...
                            </Text>
                            <Text size={1} muted>
                              晚: {day.evening?.substring(0, 30) || '(空)'}...
                            </Text>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {preview.success && (
                    <Button
                      text={`確認匯入 ${preview.days.length} 天行程`}
                      tone="positive"
                      onClick={handleImport}
                    />
                  )}

                  {preview.errors.length > 0 && (
                    <Box>
                      <Text size={1} weight="semibold">錯誤：</Text>
                      {preview.errors.map((err, i) => (
                        <Text key={i} size={1} muted>
                          {err}
                        </Text>
                      ))}
                    </Box>
                  )}
                </Stack>
              </Card>
            )}
          </Stack>
        </Box>
      ),
      onClose: handleClose,
    },
  }
}
