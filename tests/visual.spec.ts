import { test, expect } from '@playwright/test'
import { ALL_ROUTES, HOME_STOPS, gotoStable, scrollToStop, waitForVessel } from './helpers'

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
