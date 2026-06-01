import { test, expect } from '@playwright/test'

const SLUG = 'k8oeyepp'
const ROUTE = `/quote/${SLUG}`

test('production quote uses the 3D hero and preserves itinerary/pricing content', async ({ page }) => {
  await page.goto(ROUTE)

  await expect(page.getByTestId('quote-3d-stage')).toBeVisible()
  await page
    .locator('[data-scene-ready="true"]')
    .first()
    .waitFor({ state: 'attached', timeout: 20000 })

  await expect(page.locator('#itinerary')).toBeAttached()
  await expect(page.locator('#quote-pricing')).toBeAttached()
})
