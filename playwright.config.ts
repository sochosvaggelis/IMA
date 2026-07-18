import { defineConfig, devices } from '@playwright/test'

/**
 * Visual + layout regression across the widths the design actually branches
 * on: Tailwind's sm/md/lg breakpoints, plus the [@media(min-height:820px)]
 * gate the hero stats use. Heights matter as much as widths here — the hero
 * panels are height-budgeted (dvh caps), so a short laptop screen is its own
 * case, not a small desktop.
 */
const VIEWPORTS = [
  { name: 'mobile', width: 360, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'ultrawide', width: 3440, height: 1440 },
]

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,

  // One folder per viewport, keyed by platform: baselines are rendered
  // pixels, and the same page rasterises differently on another OS. A run on
  // a new platform grows its own baseline set instead of failing against one
  // rendered elsewhere.
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}',

  expect: {
    // Screenshot capture itself can take several seconds under software GL;
    // the 5s default was timing out mid-capture on the bigger viewports.
    timeout: 20_000,
    toHaveScreenshot: {
      // Zero would be ideal, but WebGL linework rasterisation can wobble by a
      // handful of pixels along edges between runs. A real layout break moves
      // whole regions, orders of magnitude past this.
      maxDiffPixelRatio: 0.002,
      // CSS transitions/animations are frozen by Playwright; the WebGL side
      // is frozen by the app's own ?e2e=1 mode.
      animations: 'disabled',
    },
  },

  use: {
    baseURL: 'http://localhost:5173',
    // Pin the language: the app auto-detects from the browser, and Greek and
    // English baselines are different pages.
    locale: 'en-US',
    // Belt and braces with ?e2e=1 — the app holds the vessel's rest pose
    // under reduced motion even where the flag is missed.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },

  projects: VIEWPORTS.map((v) => ({
    name: v.name,
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: v.width, height: v.height },
    },
  })),

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
