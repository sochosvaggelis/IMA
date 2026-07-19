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
 * Layout invariants — rules that must hold at EVERY viewport, checked from
 * geometry rather than pixels. These are platform-independent (no rendered
 * baselines), so they are what CI runs on every push.
 */

for (const route of ALL_ROUTES) {
  test.describe(`route ${route}`, () => {
    test('no horizontal overflow', async ({ page }) => {
      await gotoStable(page, route)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, 'page must never scroll sideways').toBeLessThanOrEqual(0)
    })

    test('header is visible', async ({ page }) => {
      await gotoStable(page, route)
      await expect(page.locator('header').first()).toBeVisible()
    })
  })
}

test.describe('home hero overlays', () => {
  // The overlays and the runway only exist on the desktop sweep.
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) < DESKTOP_LAYOUT_WIDTH,
    'mobile home is the tap explorer, not the sweep',
  )

  test('intro holds the opening stop, then yields to the systems', async ({ page }) => {
    await gotoStable(page, '/')
    await waitForVessel(page)

    const intro = page.getByTestId('hero-intro')
    await expect(intro).toBeVisible()
    await expectInsideViewport(page, intro, 'hero intro')

    // One stop down the intro must be gone — it shares its screen position
    // with the system panels, and both at once is a layered mess.
    await scrollToStop(page, 1)
    await expect(intro).toHaveCSS('opacity', '0')
  })

  test('every system panel fits inside its viewport', async ({ page }) => {
    await gotoStable(page, '/')
    await waitForVessel(page)

    // Stops 1..9 each hold one system; 0 is the intro and the last is the
    // closing frame with no panel.
    for (let stop = 1; stop < HOME_STOPS - 1; stop++) {
      await scrollToStop(page, stop)

      const panel = page.getByTestId('system-panel')
      await expect.soft(panel, `stop ${stop}: panel fully faded in`).toHaveCSS('opacity', '1')
      await expectInsideViewport(page, panel, `stop ${stop}: system panel`)
    }
  })
})

test.describe('home mobile explorer', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) >= DESKTOP_LAYOUT_WIDTH,
    'desktop home is the sweep, not the explorer',
  )

  test('page scrolls freely and a tapped system expands in place', async ({ page }) => {
    await gotoStable(page, '/')
    await waitForVessel(page)

    // The sweep's mandatory snapping must NOT leak into this layout — with no
    // runway on screen it would glue the page to the top.
    const snap = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollSnapType,
    )
    expect(snap, 'no scroll snapping on the explorer').toContain('none')

    const explorer = page.getByTestId('systems-explorer')
    await expect(explorer).toBeVisible()
    await expect(explorer.locator('h1')).toBeVisible()

    // Tap the third system: the row expands and shows its diagram.
    const row = explorer.getByRole('button', { name: /power distribution/i })
    await row.scrollIntoViewIfNeeded()
    await row.click()
    await expect(row).toHaveAttribute('aria-expanded', 'true')
    await expect(explorer.getByTestId('explorer-diagram')).toBeVisible()

    // Expansion must not break the page's one hard geometry rule.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, 'expanded diagram must not overflow sideways').toBeLessThanOrEqual(0)
  })
})

/** The element's whole box must sit inside the viewport — an overlay that
    pokes past any edge is exactly the "μετακίνησε αυτό" bug this suite exists
    to catch before a human does. */
async function expectInsideViewport(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator,
  label: string,
): Promise<void> {
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('viewport size unavailable')
  const box = await locator.boundingBox()
  expect(box, `${label}: has a bounding box`).not.toBeNull()
  if (!box) return

  expect.soft(box.x, `${label}: left edge on screen`).toBeGreaterThanOrEqual(0)
  expect.soft(box.y, `${label}: top edge on screen`).toBeGreaterThanOrEqual(0)
  expect.soft(box.x + box.width, `${label}: right edge on screen`).toBeLessThanOrEqual(
    viewport.width + 0.5,
  )
  expect.soft(box.y + box.height, `${label}: bottom edge on screen`).toBeLessThanOrEqual(
    viewport.height + 0.5,
  )
}
