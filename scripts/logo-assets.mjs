/**
 * Generates the site's logo assets from the master artwork.
 *
 *     node scripts/logo-assets.mjs
 *
 * public/logo.png is the artwork as supplied: navy ink, for light backgrounds.
 * The site is dark, so it needs a white variant and one in the cyan accent —
 * hence these, rather than hand-editing files that must stay identical in
 * everything but colour. The favicon is cut from the same master so the tab
 * icon and the header can never drift apart.
 *
 * WHY A FLAT RGB REPLACEMENT IS SAFE HERE. The master is a single ink on a
 * transparent field, and its edges are antialiased through the ALPHA channel:
 * every one of its 3.7k fully-opaque pixels carries the navy, and 98.5% of all
 * inked pixels sit within a few levels of it. So overwriting RGB while keeping
 * alpha reproduces every curve and every letterform exactly.
 *
 * That is a property of this file, not of PNGs in general — artwork whose
 * antialiasing blends RGB toward the background, or which carries a second
 * ink (a white detail inside the navy, say), would be wrecked by this. Hence
 * the guard below, which refuses to run unless it can confirm both.
 *
 * The guard ignores pixels below ALPHA_FLOOR. The faintest ~1% of the fringe
 * carries meaningless RGB — values like rgb(0,0,128) at alpha 2 — because
 * un-premultiplying a nearly-zero alpha amplifies rounding error. Those
 * pixels are invisible, and testing them fails a file that is in fact clean.
 *
 * Chromium does the pixel work: it is already present for Playwright, and the
 * canvas API decodes and re-encodes PNG without adding an image dependency.
 */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'

const SOURCE = 'public/logo.png'

/** Colours are the site's own tokens, resolved to sRGB — see src/index.css.
    signal-400 is oklch(0.78 0.135 210), the accent used for live/technical
    detail throughout the site. */
const VARIANTS = [
  { file: 'public/logo-white.png', rgb: [255, 255, 255], note: 'white' },
  { file: 'public/logo-signal.png', rgb: [0, 206, 231], note: 'signal-400 cyan' },
]

/** The favicon, cut from whichever variant matches `rgb`. 180px covers the
    largest icon slot browsers ask for; `plate` is the theme-color in
    index.html, and `radius`/`inset` are fractions of the square. */
const FAVICON = {
  file: 'public/favicon.png',
  rgb: [0, 206, 231],
  size: 180,
  plate: '#0b1220',
  radius: 0.1875,
  inset: 0.76,
  note: 'cyan badge on the theme plate',
}

/** Guard thresholds — see the single-ink note above. */
/** Alpha below which a pixel's RGB is un-premultiplication noise, not colour. */
const ALPHA_FLOOR = 8
/** Per-channel distance still counted as "the same ink". */
const INK_TOLERANCE = 24
/** Share of visible inked pixels that must be that one ink. */
const SINGLE_INK_SHARE = 0.95
/** Any channel above this on a visible pixel means a second, lighter ink. */
const LIGHT_INK = 170

const browser = await chromium.launch()
const page = await browser.newPage()

const source = `data:image/png;base64,${readFileSync(SOURCE).toString('base64')}`

const results = await page.evaluate(
  async ({ source, variants, favicon, minShare, alphaFloor, tolerance, lightInk }) => {
    const img = new Image()
    img.src = source
    await img.decode()

    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const original = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Verify the single-ink assumption before trusting the recolour.
    // The dominant ink is taken from the fully-opaque core, which is the only
    // place RGB is beyond doubt; the share is then measured across everything
    // visible, so a genuinely two-tone file still fails.
    const d = original.data
    const solid = new Map()
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] !== 255) continue
      const key = `${d[i]},${d[i + 1]},${d[i + 2]}`
      solid.set(key, (solid.get(key) ?? 0) + 1)
    }
    if (solid.size === 0) return { error: 'no fully opaque pixels to read the ink from' }
    const ink = [...solid.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const [ir, ig, ib] = ink.split(',').map(Number)

    let visible = 0
    let sameInk = 0
    let light = 0
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < alphaFloor) continue
      visible++
      const dist = Math.max(
        Math.abs(d[i] - ir),
        Math.abs(d[i + 1] - ig),
        Math.abs(d[i + 2] - ib),
      )
      if (dist <= tolerance) sameInk++
      if (d[i] > lightInk && d[i + 1] > lightInk && d[i + 2] > lightInk) light++
    }

    const share = sameInk / visible
    if (light > 0) {
      return { error: `${light} light pixels: artwork has a second ink, refusing to flatten` }
    }
    if (share < minShare) {
      return { error: `not single-ink: dominant ${ink} covers only ${(share * 100).toFixed(1)}%` }
    }

    const out = []
    for (const variant of variants) {
      const copy = new ImageData(
        new Uint8ClampedArray(original.data),
        canvas.width,
        canvas.height,
      )
      for (let i = 0; i < copy.data.length; i += 4) {
        if (copy.data[i + 3] === 0) continue
        copy.data[i] = variant.rgb[0]
        copy.data[i + 1] = variant.rgb[1]
        copy.data[i + 2] = variant.rgb[2]
      }
      ctx.putImageData(copy, 0, 0)
      out.push({ file: variant.file, data: canvas.toDataURL('image/png') })
      if (variant.rgb.join() === favicon.rgb.join()) {
        // Favicon: the same recoloured badge, centred on a square plate.
        //
        // Square because a favicon is displayed in one, and the artwork is
        // not — left to the browser, a 153x160 image is squashed rather than
        // letterboxed. Plated rather than transparent because the mark is
        // light: on a light browser theme a transparent favicon would very
        // nearly vanish.
        const f = document.createElement('canvas')
        f.width = favicon.size
        f.height = favicon.size
        const fx = f.getContext('2d')
        fx.fillStyle = favicon.plate
        fx.beginPath()
        fx.roundRect(0, 0, favicon.size, favicon.size, favicon.size * favicon.radius)
        fx.fill()

        // Contain, not cover: the badge is round and must not be cropped.
        const scale = (favicon.size * favicon.inset) / Math.max(canvas.width, canvas.height)
        const w = canvas.width * scale
        const h = canvas.height * scale
        fx.drawImage(canvas, (favicon.size - w) / 2, (favicon.size - h) / 2, w, h)
        out.push({ file: favicon.file, data: f.toDataURL('image/png') })
      }
    }
    return { ink, share, visible, size: [canvas.width, canvas.height], out }
  },
  {
    source,
    variants: VARIANTS,
    favicon: FAVICON,
    minShare: SINGLE_INK_SHARE,
    alphaFloor: ALPHA_FLOOR,
    tolerance: INK_TOLERANCE,
    lightInk: LIGHT_INK,
  },
)

await browser.close()

if (results.error) {
  console.error(`${SOURCE}: ${results.error}`)
  process.exit(1)
}

console.log(
  `${SOURCE}: ${results.size.join('x')}, ink rgb(${results.ink}) over ` +
    `${(results.share * 100).toFixed(1)}% of ${results.visible} visible pixels`,
)

for (const { file, data } of results.out) {
  writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'))
  const note = [...VARIANTS, FAVICON].find((v) => v.file === file)?.note ?? ''
  console.log(`  wrote ${file} (${note})`)
}
