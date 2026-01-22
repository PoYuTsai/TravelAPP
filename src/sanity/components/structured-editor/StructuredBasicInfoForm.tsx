// src/sanity/components/structured-editor/StructuredBasicInfoForm.tsx
import { Box, Text, Stack, Flex, Card, Checkbox, TextInput, Select } from '@sanity/ui'
import { ARRIVAL_FLIGHTS, DEPARTURE_FLIGHTS, VEHICLE_TYPES, getFlightHint } from './flight-data'
import type { BasicInfo } from './types'

interface Props {
  value: BasicInfo
  onChange: (value: BasicInfo) => void
  totalDays: number
}

export function StructuredBasicInfoForm({ value, onChange, totalDays }: Props) {
  const updateField = <K extends keyof BasicInfo>(field: K, fieldValue: BasicInfo[K]) => {
    onChange({ ...value, [field]: fieldValue })
  }

  const arrivalHint = getFlightHint(ARRIVAL_FLIGHTS, value.arrivalFlight.preset)
  const departureHint = getFlightHint(DEPARTURE_FLIGHTS, value.departureFlight.preset)

  const totalPeople = value.adults + value.children

  return (
    <Stack space={4}>
      {/* 姓名 */}
      <Box>
        <Text size={1} weight="semibold" style={{ marginBottom: '6px' }}>
          客戶姓名
        </Text>
        <TextInput
          value={value.clientName}
          onChange={(e) => updateField('clientName', e.currentTarget.value)}
          placeholder="王小明"
        />
      </Box>

      {/* 日期 */}
      <Flex gap={3}>
        <Box style={{ flex: 1 }}>
          <Text size={1} weight="semibold" style={{ marginBottom: '6px' }}>
            開始日期
          </Text>
          <TextInput
            type="date"
            value={value.startDate}
            onChange={(e) => updateField('startDate', e.currentTarget.value)}
          />
        </Box>
        <Box style={{ flex: 1 }}>
          <Text size={1} weight="semibold" style={{ marginBottom: '6px' }}>
            結束日期
          </Text>
          <TextInput
            type="date"
            value={value.endDate}
            onChange={(e) => updateField('endDate', e.currentTarget.value)}
          />
        </Box>
        <Box style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
          <Text size={1} muted>
            {totalDays > 0 ? `${totalDays}天${totalDays - 1}夜` : ''}
          </Text>
        </Box>
      </Flex>

      {/* 航班資訊 */}
      <Card padding={3} tone="transparent" border radius={2}>
        <Text size={1} weight="semibold" style={{ marginBottom: '12px' }}>
          航班資訊
        </Text>
        <Stack space={3}>
          {/* 接機航班 */}
          <Box>
            <Flex gap={2} align="center">
              <Text size={1} style={{ width: '70px' }}>
                接機航班
              </Text>
              <Box style={{ flex: 1 }}>
                <Select
                  value={value.arrivalFlight.preset}
                  onChange={(e) =>
                    updateField('arrivalFlight', {
                      ...value.arrivalFlight,
                      preset: e.currentTarget.value,
                    })
                  }
                >
                  <option value="">選擇航班...</option>
                  {ARRIVAL_FLIGHTS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Box>
            </Flex>
            {value.arrivalFlight.preset === 'custom' && (
              <Box style={{ marginTop: '8px', marginLeft: '78px' }}>
                <TextInput
                  value={value.arrivalFlight.custom || ''}
                  onChange={(e) =>
                    updateField('arrivalFlight', {
                      ...value.arrivalFlight,
                      custom: e.currentTarget.value,
                    })
                  }
                  placeholder="航空公司 航班號 (起飛-抵達)"
                  fontSize={1}
                />
              </Box>
            )}
            {arrivalHint && (
              <Text size={0} muted style={{ marginTop: '4px', marginLeft: '78px' }}>
                {arrivalHint}
              </Text>
            )}
          </Box>

          {/* 送機航班 */}
          <Box>
            <Flex gap={2} align="center">
              <Text size={1} style={{ width: '70px' }}>
                送機航班
              </Text>
              <Box style={{ flex: 1 }}>
                <Select
                  value={value.departureFlight.preset}
                  onChange={(e) =>
                    updateField('departureFlight', {
                      ...value.departureFlight,
                      preset: e.currentTarget.value,
                    })
                  }
                >
                  <option value="">選擇航班...</option>
                  {DEPARTURE_FLIGHTS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Box>
            </Flex>
            {value.departureFlight.preset === 'custom' && (
              <Box style={{ marginTop: '8px', marginLeft: '78px' }}>
                <TextInput
                  value={value.departureFlight.custom || ''}
                  onChange={(e) =>
                    updateField('departureFlight', {
                      ...value.departureFlight,
                      custom: e.currentTarget.value,
                    })
                  }
                  placeholder="航空公司 航班號 (起飛-抵達)"
                  fontSize={1}
                />
              </Box>
            )}
            {departureHint && (
              <Text size={0} muted style={{ marginTop: '4px', marginLeft: '78px' }}>
                {departureHint}
              </Text>
            )}
          </Box>
        </Stack>
      </Card>

      {/* 人數 */}
      <Card padding={3} tone="transparent" border radius={2}>
        <Text size={1} weight="semibold" style={{ marginBottom: '12px' }}>
          人數
        </Text>
        <Flex gap={3} wrap="wrap">
          <Box style={{ width: '80px' }}>
            <Text size={0} muted style={{ marginBottom: '4px' }}>
              成人
            </Text>
            <TextInput
              type="number"
              min={1}
              value={value.adults}
              onChange={(e) => updateField('adults', parseInt(e.currentTarget.value) || 1)}
            />
          </Box>
          <Box style={{ width: '80px' }}>
            <Text size={0} muted style={{ marginBottom: '4px' }}>
              小朋友
            </Text>
            <TextInput
              type="number"
              min={0}
              value={value.children}
              onChange={(e) => updateField('children', parseInt(e.currentTarget.value) || 0)}
            />
          </Box>
          <Box style={{ flex: 1, minWidth: '150px' }}>
            <Text size={0} muted style={{ marginBottom: '4px' }}>
              小朋友年齡
            </Text>
            <TextInput
              value={value.childrenAges}
              onChange={(e) => updateField('childrenAges', e.currentTarget.value)}
              placeholder="例：5歲、8歲"
              disabled={value.children === 0}
            />
          </Box>
        </Flex>
        <Text size={1} style={{ marginTop: '8px' }}>
          總人數：<strong>{totalPeople} 人</strong>
        </Text>
      </Card>

      {/* 服務選項 */}
      <Card padding={3} tone="transparent" border radius={2}>
        <Text size={1} weight="semibold" style={{ marginBottom: '12px' }}>
          服務選項
        </Text>
        <Stack space={3}>
          {/* 導遊 */}
          <Flex gap={3} align="center">
            <Checkbox
              checked={value.guideService.required}
              onChange={(e) =>
                updateField('guideService', {
                  ...value.guideService,
                  required: e.currentTarget.checked,
                })
              }
            />
            <Text size={1} style={{ width: '100px' }}>
              需要導遊
            </Text>
            {value.guideService.required && (
              <>
                <Flex gap={1} align="center">
                  <TextInput
                    type="number"
                    min={1}
                    value={value.guideService.quantity}
                    onChange={(e) =>
                      updateField('guideService', {
                        ...value.guideService,
                        quantity: parseInt(e.currentTarget.value) || 1,
                      })
                    }
                    style={{ width: '60px' }}
                  />
                  <Text size={1}>位</Text>
                </Flex>
                <Flex gap={1} align="center">
                  <TextInput
                    type="number"
                    min={1}
                    value={value.guideService.days ?? totalDays}
                    onChange={(e) =>
                      updateField('guideService', {
                        ...value.guideService,
                        days: parseInt(e.currentTarget.value) || 1,
                      })
                    }
                    style={{ width: '60px' }}
                  />
                  <Text size={1}>天</Text>
                </Flex>
              </>
            )}
          </Flex>

          {/* 兒童座椅 */}
          <Flex gap={3} align="center">
            <Checkbox
              checked={value.childSeat.required}
              onChange={(e) =>
                updateField('childSeat', {
                  ...value.childSeat,
                  required: e.currentTarget.checked,
                })
              }
            />
            <Text size={1} style={{ width: '100px' }}>
              兒童座椅
            </Text>
            {value.childSeat.required && (
              <>
                <Flex gap={1} align="center">
                  <TextInput
                    type="number"
                    min={1}
                    value={value.childSeat.quantity}
                    onChange={(e) =>
                      updateField('childSeat', {
                        ...value.childSeat,
                        quantity: parseInt(e.currentTarget.value) || 1,
                      })
                    }
                    style={{ width: '60px' }}
                  />
                  <Text size={1}>張</Text>
                </Flex>
                <Flex gap={1} align="center">
                  <TextInput
                    type="number"
                    min={1}
                    value={value.childSeat.days || totalDays}
                    onChange={(e) =>
                      updateField('childSeat', {
                        ...value.childSeat,
                        days: parseInt(e.currentTarget.value) || 1,
                      })
                    }
                    style={{ width: '60px' }}
                  />
                  <Text size={1}>天</Text>
                </Flex>
              </>
            )}
          </Flex>

          {/* 額外雙條車 */}
          <Flex gap={3} align="center">
            <Checkbox
              checked={value.extraVehicle.required}
              onChange={(e) =>
                updateField('extraVehicle', {
                  ...value.extraVehicle,
                  required: e.currentTarget.checked,
                })
              }
            />
            <Text size={1} style={{ width: '100px' }}>
              雙條車（行李）
            </Text>
            {value.extraVehicle.required && (
              <>
                <Flex gap={1} align="center">
                  <TextInput
                    type="number"
                    min={1}
                    value={value.extraVehicle.quantity}
                    onChange={(e) =>
                      updateField('extraVehicle', {
                        ...value.extraVehicle,
                        quantity: parseInt(e.currentTarget.value) || 1,
                      })
                    }
                    style={{ width: '60px' }}
                  />
                  <Text size={1}>台</Text>
                </Flex>
                <Flex gap={1} align="center">
                  <TextInput
                    type="number"
                    min={1}
                    value={value.extraVehicle.days || totalDays}
                    onChange={(e) =>
                      updateField('extraVehicle', {
                        ...value.extraVehicle,
                        days: parseInt(e.currentTarget.value) || 1,
                      })
                    }
                    style={{ width: '60px' }}
                  />
                  <Text size={1}>天</Text>
                </Flex>
              </>
            )}
          </Flex>
        </Stack>
      </Card>

      {/* 車輛安排 */}
      <Card padding={3} tone="transparent" border radius={2}>
        <Text size={1} weight="semibold" style={{ marginBottom: '12px' }}>
          車輛安排
        </Text>
        <Flex gap={3} wrap="wrap">
          <Flex gap={1} align="center">
            <Text size={1}>包車</Text>
            <TextInput
              type="number"
              min={1}
              value={value.vehicleCount}
              onChange={(e) => updateField('vehicleCount', parseInt(e.currentTarget.value) || 1)}
              style={{ width: '60px' }}
            />
            <Text size={1}>台</Text>
          </Flex>
          <Box style={{ flex: 1, minWidth: '150px' }}>
            <Select
              value={value.vehicleType}
              onChange={(e) => updateField('vehicleType', e.currentTarget.value)}
            >
              {VEHICLE_TYPES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Box>
        </Flex>
        <Box style={{ marginTop: '12px' }}>
          <Text size={0} muted style={{ marginBottom: '4px' }}>
            行李備註
          </Text>
          <TextInput
            value={value.luggageNote}
            onChange={(e) => updateField('luggageNote', e.currentTarget.value)}
            placeholder="例：1台大約可放6~7顆28~30吋"
          />
        </Box>
      </Card>
    </Stack>
  )
}
