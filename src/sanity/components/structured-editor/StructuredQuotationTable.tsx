// src/sanity/components/structured-editor/StructuredQuotationTable.tsx
import { Fragment } from 'react'
import { Box, Text, Stack, Flex, Card, TextInput, Button } from '@sanity/ui'
import { AddIcon, TrashIcon } from '@sanity/icons'
import {
  AIRPORT_TRANSFER_FEES,
  CHILD_SEAT_FEE_PER_DAY,
  DRIVER_GUIDE_ROOM_FEE_PER_NIGHT,
  GUIDE_FEE_PER_DAY,
  INSURANCE_FEE_PER_PERSON,
  resolveFleet,
} from '@/lib/pricing/perPersonRates'
import type { BasicInfo, DailyQuotationItem, OtherQuotationItem } from './types'
import { getWeekday, generateDateRange } from './types'

interface Props {
  basicInfo: BasicInfo
  dailyItems: DailyQuotationItem[]
  otherItems: OtherQuotationItem[]
  onDailyItemsChange: (items: DailyQuotationItem[]) => void
  onOtherItemsChange: (items: OtherQuotationItem[]) => void
}

// 預設單價
const DEFAULT_PRICES = {
  extraVehicle: 1500,
  outOfTownStay: DRIVER_GUIDE_ROOM_FEE_PER_NIGHT,
}

export function legacyAirportTransferFee(vehicleType: string): number {
  return vehicleType === 'sedan'
    ? AIRPORT_TRANSFER_FEES.sedan
    : AIRPORT_TRANSFER_FEES.van
}

export function resolveLegacyDailyQuotationItems(
  basicInfo: BasicInfo,
  dailyItems: DailyQuotationItem[],
): DailyQuotationItem[] {
  if (!basicInfo.startDate || !basicInfo.endDate) return dailyItems

  const dates = generateDateRange(basicInfo.startDate, basicInfo.endDate)
  const occupiedSeats = Math.max(
    1,
    basicInfo.adults + basicInfo.children + basicInfo.infants,
  )
  const fleet = resolveFleet(occupiedSeats)

  return dates.map((date, index) => {
    const existing = dailyItems.find((item) => item.date === date)
    const isFirst = index === 0
    const isLast = index === dates.length - 1
    if (existing) {
      const isPureAirportDropOff =
        isLast && /^(?:機場)?送機(?:服務)?$/.test(existing.description.trim())
      return isPureAirportDropOff
        ? { ...existing, price: legacyAirportTransferFee(fleet.vehicle) }
        : existing
    }

    let description = ''
    let price = 4000

    if (isFirst) {
      description = '接機+市區'
      price = 3700
    } else if (isLast) {
      description = '送機'
      price = legacyAirportTransferFee(fleet.vehicle)
    }

    return {
      date,
      weekday: getWeekday(date),
      description,
      price,
    }
  })
}

/**
 * Resolve the legacy editor add-ons from canonical policy constants.
 * Presence of an insurance row is the explicit opt-in; it is never added by default.
 */
export function buildLegacyOtherQuotationItems(
  basicInfo: BasicInfo,
  otherItems: OtherQuotationItem[],
): OtherQuotationItem[] {
  const items: OtherQuotationItem[] = []
  const occupiedSeats = Math.max(
    1,
    basicInfo.adults + basicInfo.children + basicInfo.infants,
  )
  const fleet = resolveFleet(occupiedSeats)

  if (basicInfo.guideService.required) {
    const quantity = basicInfo.guideService.quantity || 1
    const days = basicInfo.guideService.days || 1
    items.push({
      type: 'guide',
      description: '中文導遊（選配）',
      unitPrice: GUIDE_FEE_PER_DAY,
      quantity,
      days,
      subtotal: GUIDE_FEE_PER_DAY * quantity * days,
    })
  }

  if (basicInfo.childSeat.required) {
    const quantity = basicInfo.childSeat.quantity || 1
    const days = basicInfo.childSeat.days || 1
    items.push({
      type: 'childSeat',
      description: '兒童安全座椅',
      unitPrice: CHILD_SEAT_FEE_PER_DAY,
      quantity,
      days,
      subtotal: CHILD_SEAT_FEE_PER_DAY * quantity * days,
    })
  }

  if (basicInfo.extraVehicle.required) {
    const quantity = basicInfo.extraVehicle.quantity || 1
    const days = basicInfo.extraVehicle.days || 1
    const unitPrice =
      otherItems.find((item) => item.type === 'extraVehicle')?.unitPrice ||
      DEFAULT_PRICES.extraVehicle
    items.push({
      type: 'extraVehicle',
      description: '額外行李車（人工確認）',
      unitPrice,
      quantity,
      days,
      subtotal: unitPrice * quantity * days,
    })
  }

  // The row itself is the legacy editor's explicit insurance selection.
  if (otherItems.some((item) => item.type === 'insurance')) {
    const quantity = basicInfo.adults + basicInfo.children + basicInfo.infants
    items.push({
      type: 'insurance',
      description: '旅遊保險（選配）',
      unitPrice: INSURANCE_FEE_PER_PERSON,
      quantity,
      days: 1,
      subtotal: INSURANCE_FEE_PER_PERSON * quantity,
    })
  }

  const existingOutOfTown = otherItems.find((item) => item.type === 'outOfTownStay')
  const outOfTownNights = existingOutOfTown?.days || 0
  if (outOfTownNights > 0) {
    const staffCount =
      fleet.carCount +
      (basicInfo.guideService.required ? basicInfo.guideService.quantity : 0)
    items.push({
      type: 'outOfTownStay',
      description: '外地住宿補貼',
      unitPrice: DEFAULT_PRICES.outOfTownStay,
      quantity: staffCount,
      days: outOfTownNights,
      subtotal: DEFAULT_PRICES.outOfTownStay * staffCount * outOfTownNights,
    })
  }

  for (const item of otherItems.filter((candidate) => candidate.type === 'custom')) {
    items.push({
      ...item,
      subtotal: item.unitPrice * item.quantity * item.days,
    })
  }

  return items
}

export function StructuredQuotationTable({
  basicInfo,
  dailyItems,
  otherItems,
  onDailyItemsChange,
  onOtherItemsChange,
}: Props) {
  const totalPeople = basicInfo.adults + basicInfo.children + basicInfo.infants
  const fleet = resolveFleet(Math.max(1, totalPeople))
  const currentDailyItems = resolveLegacyDailyQuotationItems(basicInfo, dailyItems)
  const vehicleCount = fleet.carCount
  // 每日包車費用 = 單價 x 台數
  const dailyTotal = currentDailyItems.reduce((sum, item) => sum + item.price * vehicleCount, 0)

  const currentOtherItems = buildLegacyOtherQuotationItems(basicInfo, otherItems)
  const otherTotal = currentOtherItems.reduce((sum, item) => sum + item.subtotal, 0)
  const grandTotal = dailyTotal + otherTotal

  // 更新每日項目
  const updateDailyItem = (index: number, field: keyof DailyQuotationItem, value: any) => {
    const newItems = [...currentDailyItems]
    newItems[index] = { ...newItems[index], [field]: value }
    onDailyItemsChange(newItems)
  }

  // 更新其他項目單價
  const updateOtherItemPrice = (type: OtherQuotationItem['type'], unitPrice: number) => {
    const newItems = otherItems.map((item) =>
      item.type === type ? { ...item, unitPrice } : item
    )
    // 如果不存在則新增
    if (!newItems.find((i) => i.type === type)) {
      newItems.push({
        type,
        description: '',
        unitPrice,
        quantity: 1,
        days: 1,
        subtotal: unitPrice,
      })
    }
    onOtherItemsChange(newItems)
  }

  const addInsurance = () => {
    if (otherItems.some((item) => item.type === 'insurance')) return
    onOtherItemsChange([
      ...otherItems,
      {
        type: 'insurance',
        description: '旅遊保險（選配）',
        unitPrice: INSURANCE_FEE_PER_PERSON,
        quantity: totalPeople,
        days: 1,
        subtotal: INSURANCE_FEE_PER_PERSON * totalPeople,
      },
    ])
  }

  const removeInsurance = () => {
    onOtherItemsChange(otherItems.filter((item) => item.type !== 'insurance'))
  }

  // 更新外地住宿晚數
  const updateOutOfTownNights = (nights: number) => {
    const existing = otherItems.find((i) => i.type === 'outOfTownStay')
    if (existing) {
      const newItems = otherItems.map((item) =>
        item.type === 'outOfTownStay' ? { ...item, days: nights } : item
      )
      onOtherItemsChange(newItems)
    } else {
      onOtherItemsChange([
        ...otherItems,
        {
          type: 'outOfTownStay',
          description: '外地住宿補貼',
          unitPrice: DEFAULT_PRICES.outOfTownStay,
          quantity: 1,
          days: nights,
          subtotal: 0,
        },
      ])
    }
  }

  // 新增自訂項目
  const addCustomItem = () => {
    onOtherItemsChange([
      ...otherItems,
      {
        type: 'custom',
        description: '',
        unitPrice: 0,
        quantity: 1,
        days: 1,
        subtotal: 0,
      },
    ])
  }

  // 刪除自訂項目
  const removeCustomItem = (index: number) => {
    const customItems = otherItems.filter((i) => i.type === 'custom')
    const itemToRemove = customItems[index]
    onOtherItemsChange(otherItems.filter((i) => i !== itemToRemove))
  }

  // 更新自訂項目
  const updateCustomItem = (index: number, field: keyof OtherQuotationItem, value: any) => {
    let customIndex = 0
    const newItems = otherItems.map((item) => {
      if (item.type === 'custom') {
        if (customIndex === index) {
          customIndex++
          return { ...item, [field]: value }
        }
        customIndex++
      }
      return item
    })
    onOtherItemsChange(newItems)
  }

  const formatDate = (dateStr: string) => {
    // 使用 T00:00:00 避免時區問題
    const d = new Date(dateStr + 'T00:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  return (
    <Stack space={4}>
      {/* 每日包車費用 */}
      <Card padding={3} tone="transparent" border radius={2}>
        <Flex align="center" gap={2} style={{ marginBottom: '12px' }}>
          <Text size={1} weight="semibold">
            每日包車費用
          </Text>
          {vehicleCount > 1 && (
            <Text size={0} muted>
              （{vehicleCount} 台）
            </Text>
          )}
        </Flex>
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: vehicleCount > 1 ? '80px 1fr 80px 50px 80px' : '80px 1fr 100px 80px',
            gap: '8px',
            fontSize: '13px',
          }}
        >
          <Text size={0} weight="semibold" muted>
            日期
          </Text>
          <Text size={0} weight="semibold" muted>
            說明
          </Text>
          <Text size={0} weight="semibold" muted style={{ textAlign: 'right' }}>
            單價
          </Text>
          {vehicleCount > 1 && (
            <Text size={0} weight="semibold" muted style={{ textAlign: 'center' }}>
              台數
            </Text>
          )}
          <Text size={0} weight="semibold" muted style={{ textAlign: 'right' }}>
            小計
          </Text>

          {currentDailyItems.map((item, index) => (
            <Fragment key={`row-${index}`}>
              <Text size={1}>
                {formatDate(item.date)} ({item.weekday})
              </Text>
              <TextInput
                value={item.description}
                onChange={(e) => updateDailyItem(index, 'description', e.currentTarget.value)}
                fontSize={1}
                padding={2}
              />
              <TextInput
                type="number"
                value={item.price}
                onChange={(e) =>
                  updateDailyItem(index, 'price', parseInt(e.currentTarget.value) || 0)
                }
                fontSize={1}
                padding={2}
                style={{ textAlign: 'right' }}
              />
              {vehicleCount > 1 && (
                <Text size={1} style={{ textAlign: 'center', paddingTop: '8px' }}>
                  x{vehicleCount}
                </Text>
              )}
              <Text size={1} style={{ textAlign: 'right', paddingTop: '8px' }}>
                {(item.price * vehicleCount).toLocaleString()}
              </Text>
            </Fragment>
          ))}
        </Box>
        <Flex justify="flex-end" style={{ marginTop: '12px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
          <Text size={1}>
            包車小計：<strong>THB {dailyTotal.toLocaleString()}</strong>
            {vehicleCount > 1 && <span style={{ marginLeft: '8px', color: '#666' }}>（{vehicleCount}台）</span>}
          </Text>
        </Flex>
      </Card>

      {/* 其他費用 */}
      <Card padding={3} tone="transparent" border radius={2}>
        <Text size={1} weight="semibold" style={{ marginBottom: '12px' }}>
          其他費用
        </Text>
        <Stack space={2}>
          {currentOtherItems.map((item, index) => (
            <Flex key={`other-${index}`} gap={2} align="center" style={{ fontSize: '13px' }}>
              <Text size={1} style={{ width: '100px' }}>
                {item.type === 'guide' && '導遊'}
                {item.type === 'childSeat' && '兒童座椅'}
                {item.type === 'extraVehicle' && '額外行李車'}
                {item.type === 'insurance' && '保險'}
                {item.type === 'outOfTownStay' && '外地住宿'}
                {item.type === 'custom' && (
                  <TextInput
                    value={item.description}
                    onChange={(e) => {
                      const customIndex = currentOtherItems
                        .filter((i) => i.type === 'custom')
                        .indexOf(item)
                      updateCustomItem(customIndex, 'description', e.currentTarget.value)
                    }}
                    placeholder="項目名稱"
                    fontSize={1}
                    padding={2}
                  />
                )}
              </Text>

              {item.type !== 'custom' ? (
                <>
                  {item.type === 'extraVehicle' ? (
                    <TextInput
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateOtherItemPrice(item.type, parseInt(e.currentTarget.value) || 0)
                      }
                      style={{ width: '70px', textAlign: 'right' }}
                      fontSize={1}
                      padding={2}
                    />
                  ) : (
                    <Text size={1} style={{ width: '70px', textAlign: 'right' }}>
                      {item.unitPrice.toLocaleString()}
                    </Text>
                  )}
                  <Text size={1}>x</Text>
                  <Text size={1} style={{ width: '40px', textAlign: 'center' }}>
                    {item.quantity}
                  </Text>
                  <Text size={1}>{item.type === 'insurance' ? '人' : item.type === 'outOfTownStay' ? '人' : item.type === 'childSeat' ? '張' : item.type === 'extraVehicle' ? '台' : '位'}</Text>
                  {item.type !== 'insurance' && (
                    <>
                      <Text size={1}>x</Text>
                      {item.type === 'outOfTownStay' ? (
                        <TextInput
                          type="number"
                          min={0}
                          value={item.days}
                          onChange={(e) =>
                            updateOutOfTownNights(parseInt(e.currentTarget.value) || 0)
                          }
                          style={{ width: '50px', textAlign: 'center' }}
                          fontSize={1}
                          padding={2}
                        />
                      ) : (
                        <Text size={1} style={{ width: '30px', textAlign: 'center' }}>
                          {item.days}
                        </Text>
                      )}
                      <Text size={1}>{item.type === 'outOfTownStay' ? '晚' : '天'}</Text>
                    </>
                  )}
                  {item.type === 'insurance' && (
                    <Button
                      icon={TrashIcon}
                      mode="ghost"
                      tone="critical"
                      padding={2}
                      aria-label="移除旅遊保險"
                      onClick={removeInsurance}
                    />
                  )}
                </>
              ) : (
                <>
                  <TextInput
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => {
                      const customIndex = currentOtherItems
                        .filter((i) => i.type === 'custom')
                        .indexOf(item)
                      updateCustomItem(customIndex, 'unitPrice', parseInt(e.currentTarget.value) || 0)
                    }}
                    style={{ width: '70px', textAlign: 'right' }}
                    fontSize={1}
                    padding={2}
                  />
                  <Text size={1}>x</Text>
                  <TextInput
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => {
                      const customIndex = currentOtherItems
                        .filter((i) => i.type === 'custom')
                        .indexOf(item)
                      updateCustomItem(customIndex, 'quantity', parseInt(e.currentTarget.value) || 1)
                    }}
                    style={{ width: '50px', textAlign: 'center' }}
                    fontSize={1}
                    padding={2}
                  />
                  <Button
                    icon={TrashIcon}
                    mode="ghost"
                    tone="critical"
                    padding={2}
                    onClick={() => {
                      const customIndex = currentOtherItems
                        .filter((i) => i.type === 'custom')
                        .indexOf(item)
                      removeCustomItem(customIndex)
                    }}
                  />
                </>
              )}

              <Text size={1} style={{ marginLeft: 'auto', minWidth: '80px', textAlign: 'right' }}>
                = {item.subtotal.toLocaleString()}
              </Text>
            </Flex>
          ))}

          <Button
            icon={AddIcon}
            text="新增自訂項目"
            mode="ghost"
            fontSize={1}
            padding={2}
            onClick={addCustomItem}
            style={{ marginTop: '8px' }}
          />
          {!currentOtherItems.some((item) => item.type === 'insurance') && (
            <Button
              text={`加購旅遊保險（THB ${INSURANCE_FEE_PER_PERSON}／人／趟）`}
              mode="ghost"
              fontSize={1}
              padding={2}
              onClick={addInsurance}
            />
          )}
          <Text size={0} muted>
            兒童安全座椅為 THB {CHILD_SEAT_FEE_PER_DAY}／日／張，安裝於該孩童的乘客座位，不另加算一位。
          </Text>
        </Stack>

        <Flex justify="flex-end" style={{ marginTop: '12px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
          <Text size={1}>
            其他小計：<strong>THB {otherTotal.toLocaleString()}</strong>
          </Text>
        </Flex>
      </Card>

      {/* 總計 */}
      <Card padding={4} tone="primary" border radius={2}>
        <Flex justify="space-between" align="center">
          <Stack space={1}>
            <Text size={1} muted>
              包車小計：THB {dailyTotal.toLocaleString()}
            </Text>
            <Text size={1} muted>
              其他小計：THB {otherTotal.toLocaleString()}
            </Text>
          </Stack>
          <Text size={3} weight="bold">
            總計：THB {grandTotal.toLocaleString()}
          </Text>
        </Flex>
      </Card>
    </Stack>
  )
}
