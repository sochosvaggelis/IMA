import { chromium } from '@playwright/test'

const base = 'http://localhost:5174'
const out = process.argv[2] || 'coverage'
const browser = await chromium.launch()

for (const [name, w, h] of [
  ['desktop', 1440, 1024],
  ['mobile', 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, locale: 'en-US' })
  await page.goto(`${base}/coverage`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500) // let the globe spin up a few frames
  await page.screenshot({ path: `${process.env.SHOT_DIR}/${out}-${name}.png`, fullPage: true })
  await page.close()
  console.log('shot', name)
}
await browser.close()
