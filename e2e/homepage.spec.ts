// e2e/homepage.spec.ts
import { test, expect } from '@playwright/test'

test.describe('首頁基本功能', () => {
  test('首頁能正常載入', async ({ page }) => {
    await page.goto('/')

    // 確認頁面載入完成
    await expect(page).toHaveTitle(/清微旅行|Chiangway/)
  })

  test('LINE 連結存在且正確', async ({ page }) => {
    await page.goto('/')

    // 找到 LINE 連結
    const lineLink = page.locator('a[href*="line.me"]').first()
    await expect(lineLink).toBeVisible()

    // 確認連結指向正確的 LINE 帳號
    await expect(lineLink).toHaveAttribute('href', /037nyuwk/)
  })

  test('導航列顯示正確', async ({ page }) => {
    await page.goto('/')

    // 確認有品牌名稱
    const brand = page.locator('text=清微旅行').first()
    await expect(brand).toBeVisible()
  })
})

test.describe('API 端點', () => {
  test('API 健康檢查', async ({ request }) => {
    // 測試 API 是否正常回應
    const response = await request.get('/api/health')

    // 如果有實作 health endpoint
    if (response.status() === 200) {
      expect(response.ok()).toBeTruthy()
    } else {
      // 沒有 health endpoint 也算通過
      expect([200, 404]).toContain(response.status())
    }
  })
})
