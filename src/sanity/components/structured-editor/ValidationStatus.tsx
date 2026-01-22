// src/sanity/components/structured-editor/ValidationStatus.tsx
import { Box, Text, Stack, Card } from '@sanity/ui'
import { CheckmarkCircleIcon, CloseCircleIcon, CircleIcon } from '@sanity/icons'
import type { BasicInfo, OtherQuotationItem } from './types'

interface Props {
  basicInfo: BasicInfo
  otherItems: OtherQuotationItem[]
}

interface ValidationItem {
  label: string
  status: 'success' | 'error' | 'inactive'
  message: string
}

// 驗證日期是否有效
function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr + 'T00:00:00')
  return !isNaN(date.getTime())
}

// 檢查日期範圍是否合理
function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) return false
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  return start <= end
}

export function ValidationStatus({ basicInfo, otherItems }: Props) {
  const validations: ValidationItem[] = []

  // 客戶姓名驗證
  if (basicInfo.clientName?.trim()) {
    validations.push({
      label: '客戶姓名',
      status: 'success',
      message: basicInfo.clientName,
    })
  } else {
    validations.push({
      label: '客戶姓名',
      status: 'error',
      message: '必填',
    })
  }

  // 日期驗證
  const hasValidStart = isValidDate(basicInfo.startDate)
  const hasValidEnd = isValidDate(basicInfo.endDate)
  const hasValidRange = isValidDateRange(basicInfo.startDate, basicInfo.endDate)

  if (hasValidStart && hasValidEnd && hasValidRange) {
    const start = new Date(basicInfo.startDate + 'T00:00:00')
    const end = new Date(basicInfo.endDate + 'T00:00:00')
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    validations.push({
      label: '日期範圍',
      status: 'success',
      message: `${basicInfo.startDate} ~ ${basicInfo.endDate} (${days}天${days - 1}夜)`,
    })
  } else if (!hasValidStart || !hasValidEnd) {
    validations.push({
      label: '日期範圍',
      status: 'error',
      message: '請填寫開始和結束日期',
    })
  } else if (!hasValidRange) {
    validations.push({
      label: '日期範圍',
      status: 'error',
      message: '結束日期必須在開始日期之後',
    })
  }

  // 人數驗證
  const totalPeople = basicInfo.adults + basicInfo.children
  if (totalPeople > 0) {
    validations.push({
      label: '人數',
      status: 'success',
      message: `${basicInfo.adults}大${basicInfo.children}小 = ${totalPeople}人`,
    })
  } else {
    validations.push({
      label: '人數',
      status: 'error',
      message: '至少需要 1 人',
    })
  }

  // 導遊驗證
  if (basicInfo.guideService.required) {
    const hasGuide = otherItems.some((i) => i.type === 'guide' && i.unitPrice > 0)
    validations.push({
      label: '導遊',
      status: hasGuide ? 'success' : 'error',
      message: hasGuide ? '已勾選，報價已包含' : '已勾選，但報價中沒有導遊費用',
    })
  } else {
    validations.push({
      label: '導遊',
      status: 'inactive',
      message: '未勾選',
    })
  }

  // 兒童座椅驗證
  if (basicInfo.childSeat.required) {
    const hasChildSeat = otherItems.some((i) => i.type === 'childSeat' && i.unitPrice > 0)
    validations.push({
      label: '兒童座椅',
      status: hasChildSeat ? 'success' : 'error',
      message: hasChildSeat ? '已勾選，報價已包含' : '已勾選，但報價中沒有座椅費用',
    })
  } else {
    validations.push({
      label: '兒童座椅',
      status: 'inactive',
      message: '未勾選',
    })
  }

  // 雙條車驗證
  if (basicInfo.extraVehicle.required) {
    const hasExtraVehicle = otherItems.some((i) => i.type === 'extraVehicle' && i.unitPrice > 0)
    validations.push({
      label: '雙條車',
      status: hasExtraVehicle ? 'success' : 'error',
      message: hasExtraVehicle ? '已勾選，報價已包含' : '已勾選，但報價中沒有雙條車費用',
    })
  } else {
    validations.push({
      label: '雙條車',
      status: 'inactive',
      message: '未勾選',
    })
  }

  const hasErrors = validations.some((v) => v.status === 'error')

  return (
    <Card padding={3} tone={hasErrors ? 'critical' : 'positive'} border radius={2}>
      <Text size={1} weight="semibold" style={{ marginBottom: '8px' }}>
        驗證狀態
      </Text>
      <Stack space={2}>
        {validations.map((v, i) => (
          <Box key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {v.status === 'success' && <CheckmarkCircleIcon style={{ color: '#059669' }} />}
            {v.status === 'error' && <CloseCircleIcon style={{ color: '#dc2626' }} />}
            {v.status === 'inactive' && <CircleIcon style={{ color: '#9ca3af' }} />}
            <Text size={1} muted={v.status === 'inactive'}>
              {v.label}：{v.message}
            </Text>
          </Box>
        ))}
      </Stack>
      {hasErrors && (
        <Text size={0} style={{ marginTop: '8px', color: '#dc2626' }}>
          請修正以上錯誤後才能同步更新
        </Text>
      )}
    </Card>
  )
}

// 驗證函數，用於判斷是否可以儲存
export function validateEditor(
  basicInfo: BasicInfo,
  otherItems: OtherQuotationItem[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // 基本資訊驗證
  if (!basicInfo.clientName?.trim()) {
    errors.push('請填寫客戶姓名')
  }

  if (!isValidDate(basicInfo.startDate) || !isValidDate(basicInfo.endDate)) {
    errors.push('請填寫有效的開始和結束日期')
  } else if (!isValidDateRange(basicInfo.startDate, basicInfo.endDate)) {
    errors.push('結束日期必須在開始日期之後')
  }

  const totalPeople = basicInfo.adults + basicInfo.children
  if (totalPeople <= 0) {
    errors.push('至少需要 1 人')
  }

  // 服務選項驗證
  if (basicInfo.guideService.required) {
    const hasGuide = otherItems.some((i) => i.type === 'guide' && i.unitPrice > 0)
    if (!hasGuide) {
      errors.push('已勾選需要導遊，但報價中沒有導遊費用')
    }
  }

  if (basicInfo.childSeat.required) {
    const hasChildSeat = otherItems.some((i) => i.type === 'childSeat' && i.unitPrice > 0)
    if (!hasChildSeat) {
      errors.push('已勾選需要兒童座椅，但報價中沒有座椅費用')
    }
  }

  if (basicInfo.extraVehicle.required) {
    const hasExtraVehicle = otherItems.some((i) => i.type === 'extraVehicle' && i.unitPrice > 0)
    if (!hasExtraVehicle) {
      errors.push('已勾選需要雙條車，但報價中沒有雙條車費用')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
