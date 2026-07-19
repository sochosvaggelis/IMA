import { test, expect } from '@playwright/test'
import {
  ALL_ROUTES,
  DESKTOP_LAYOUT_WIDTH,
  HOME_STOPS,
  gotoStable,
  scrollToStop,
  waitForVessel,
} from './helpers'

/**
 * Pixel-level regression. Baselines live in tests/__screenshots__ and are the
 * approved look of the site; a red run here means some viewport no longer
 * renders the way it did when the baseline was blessed.
 *
 * After an INTENTIONAL visual change, re-bless with:
 *
 *     npm run test:visual:update
 *
 * and commit the changed PNGs together with the code that changed them.
 */

test.describe('home scroll sweep', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) < DESKTOP_LAYOUT_WIDTH,
    'mobile home is the tap explorer, not the sweep',
  )

  test('all snap stops', async ({ page }) => {
    // Eleven screenshots of a WebGL canvas that headless Chromium rasterises
    // in software — at 3440×1440 that is minutes, not seconds.
    test.setTimeout(480_000)

    await gotoStable(page, '/')
    await waitForVessel(page)

    // One navigation, eleven stops: the GLB load is the expensive part, and
    // soft assertions keep later stops checked even when an early one fails.
    for (let i = 0; i < HOME_STOPS; i++) {
      await scrollToStop(page, i)
      await expect
        .soft(page)
        .toHaveScreenshot(`home-stop-${String(i).padStart(2, '0')}.png`)
    }
  })
})

test.describe('home mobile explorer', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) >= DESKTOP_LAYOUT_WIDTH,
    'desktop home is the sweep, not the explorer',
  )

  test('opening view and an expanded system', async ({ page }) => {
    test.setTimeout(240_000)

    await gotoStable(page, '/')
    await waitForVessel(page)
    await expect.soft(page).toHaveScreenshot('home-explorer-closed.png')

    const row = page.getByRole('button', { name: /power distribution/i })
    await row.scrollIntoViewIfNeeded()
    await row.click()
    // The camera flight is disabled under ?e2e=1 (progress snaps), so one
    // settled frame after the click is a stable screenshot.
    await page.waitForTimeout(500)
    await expect.soft(page).toHaveScreenshot('home-explorer-open.png')
  })
})

test.describe('static pages', () => {
  for (const route of ALL_ROUTES.filter((r) => r !== '/')) {
    test(`page ${route}`, async ({ page }) => {
      await gotoStable(page, route)
      await expect(page).toHaveScreenshot(`page${route.replaceAll('/', '-')}.png`, {
        fullPage: true,
      })
    })
  }
})
