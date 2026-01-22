// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

/**
 * E2E 測試設定
 * 執行: npx playwright test
 * 報告: npx playwright show-report
 */
export default defineConfig({
  testDir: './e2e',
  // 每個測試最多 30 秒
  timeout: 30000,
  // 單一 expect 最多 5 秒
  expect: {
    timeout: 5000,
  },
  // 整體測試執行設定
  fullyParallel: true,
  // 失敗時不重試（CI 中可調整為 2）
  retries: process.env.CI ? 2 : 0,
  // CI 中使用單執行緒
  workers: process.env.CI ? 1 : undefined,
  // 報告格式
  reporter: 'html',
  // 共用設定
  use: {
    // 基準 URL
    baseURL: 'http://localhost:3000',
    // 錄製失敗測試的 trace
    trace: 'on-first-retry',
    // 截圖設定
    screenshot: 'only-on-failure',
  },
  // 測試專案設定
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // 暫時只用 Chrome，之後可加入其他瀏覽器
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  // 自動啟動開發伺服器
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
