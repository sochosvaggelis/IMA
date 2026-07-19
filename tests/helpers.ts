import type { Page } from '@playwright/test'

/** Every route the site serves — layout checks sweep all of them. */
export const ALL_ROUTES = [
  '/',
  '/services',
  '/capabilities',
  '/projects',
  '/certifications',
  '/coverage',
  '/contact',
] as const

/** Snap stops on the home sweep: intro + nine systems + closing frame. */
export const HOME_STOPS = 11

/** Below this width the home is the tap-driven explorer, not the scroll
    sweep — the same 1024px boundary as the CSS lg: breakpoint. Sweep-based
    tests must skip under it: there is no runway to scroll. */
export const DESKTOP_LAYOUT_WIDTH = 1024

/**
 * Navigate with the app's deterministic test mode on, and wait until the page
 * is actually painted the way a screenshot needs it: webfonts swapped in
 * (Inter/JetBrains Mono arrive late and move every line of text).
 */
export async function gotoStable(page: Page, path: string): Promise<void> {
  await page.goto(`${path}?e2e=1`)
  // Force EVERY face the site uses, not just the ones above the fold:
  // document.fonts.ready only covers faces requested so far, and a full-page
  // screenshot renders below-the-fold text whose weights then start loading
  // mid-capture — the screenshot call stalls on "waiting for fonts".
  await page.evaluate(() =>
    Promise.all(
      [
        '400 1em Inter',
        '500 1em Inter',
        '600 1em Inter',
        '700 1em Inter',
        '400 1em "JetBrains Mono"',
        '500 1em "JetBrains Mono"',
      ].map((face) => document.fonts.load(face)),
    ).then(() => undefined),
  )
  await page.evaluate(() => document.fonts.ready)
}

/** Wait for the hero's GLB load + edge extraction, then two frames so the
    first fully-driven render is on screen. */
export async function waitForVessel(page: Page): Promise<void> {
  await page.waitForSelector('html[data-vessel-ready]', { state: 'attached' })
  await settleFrames(page)
}

/**
 * Land exactly on snap stop `i` of the home sweep.
 *
 * Computed from the runway container rather than assumed from the viewport:
 * the header sits above it in the flow, so stop i is at container top +
 * i × viewport, which is also precisely a scroll-snap position — landing
 * there means mandatory snapping has nothing to correct.
 */
export async function scrollToStop(page: Page, i: number): Promise<void> {
  await page.evaluate((stop) => {
    const runway = document.querySelector<HTMLElement>('[data-scroll-stops]')
    if (!runway) throw new Error('scroll runway not found — is this the home page?')
    window.scrollTo({ top: runway.offsetTop + stop * window.innerHeight, behavior: 'instant' })
  }, i)
  await settleFrames(page)
}

/** Two rAFs: one for the frame that consumes the new state, one to be sure it
    has presented. In e2e mode progress snaps instantly, so this is enough. */
async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}
