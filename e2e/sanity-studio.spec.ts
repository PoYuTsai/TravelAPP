// e2e/sanity-studio.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Sanity Studio', () => {
  test('Studio 能正常載入', async ({ page }) => {
    await page.goto('/studio')

    // 等待 Sanity Studio 載入（會有登入畫面或主介面）
    // Studio 載入需要一點時間
    await page.waitForTimeout(3000)

    // 確認不是錯誤頁面
    const errorMessage = page.locator('text=Something went wrong')
    const hasError = await errorMessage.isVisible().catch(() => false)
    expect(hasError).toBeFalsy()
  })

  test('Studio 沒有 JavaScript 錯誤', async ({ page }) => {
    const errors: string[] = []

    // 監聽 console 錯誤
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    page.on('pageerror', (err) => {
      errors.push(err.message)
    })

    await page.goto('/studio')
    await page.waitForTimeout(5000)

    // 過濾掉已知的第三方錯誤
    const criticalErrors = errors.filter((err) => {
      // 忽略第三方腳本錯誤
      if (err.includes('third-party')) return false
      if (err.includes('gtag')) return false
      if (err.includes('analytics')) return false
      return true
    })

    // 應該沒有關鍵錯誤
    expect(criticalErrors.length).toBeLessThanOrEqual(0)
  })
})
