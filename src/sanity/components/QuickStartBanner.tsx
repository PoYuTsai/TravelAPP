// src/sanity/components/QuickStartBanner.tsx
// 在新文件頂部顯示快速建立提示
import { Card, Stack, Text, Button, Flex } from '@sanity/ui'
import { AddIcon } from '@sanity/icons'

interface QuickStartBannerProps {
  onQuickCreate: () => void
}

export function QuickStartBanner({ onQuickCreate }: QuickStartBannerProps) {
  return (
    <Card padding={4} radius={2} shadow={1} tone="primary" marginBottom={4}>
      <Stack space={3}>
        <Text size={2} weight="bold">
          歡迎！建立新的客戶行程
        </Text>
        <Text size={1} muted>
          點擊下方按鈕，貼上你的行程文字，系統會自動解析填入所有欄位。
        </Text>
        <Flex>
          <Button
            icon={AddIcon}
            text="快速建立行程"
            tone="primary"
            onClick={onQuickCreate}
            style={{ marginTop: '8px' }}
          />
        </Flex>
      </Stack>
    </Card>
  )
}
