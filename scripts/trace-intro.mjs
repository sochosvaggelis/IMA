/**
 * Traces the intro curtain's flight.
 *
 * Samples every animation frame from load until the curtain unmounts, writing
 * the travelling pieces' rects alongside the rects of the real elements they
 * are flying to. The last row is the one that matters: at the handover the
 * deltas must all be 0, or the swap flickers.
 *
 *   node .probe.mjs                 # as shipped
 *   node .probe.mjs nogutter        # with scrollbar-gutter forced off
 *
 * Headed on purpose: headless Chromium has no classic scrollbar, and the
 * scrollbar is exactly what the sideways drift came from.
 */
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const noGutter = args.includes('nogutter')
const size = args.find((a) => a.includes('x'))
const [width, height] = size ? size.split('x').map(Number) : [1440, 900]
const out = `logo-trace-${width}x${height}${noGutter ? '-nogutter' : ''}.csv`

const browser = await chromium.launch({ headless: false })
const page = await browser.newPage({ viewport: { width, height } })

if (noGutter) {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style')
      s.textContent = 'html{scrollbar-gutter:auto !important}'
      document.head.appendChild(s)
    })
  })
}

await page.goto('http://localhost:5199/')

const rows = await page.evaluate(async () => {
  const frame = () => new Promise((r) => requestAnimationFrame(r))
  const t0 = performance.now()
  const samples = []

  const rect = (el) => {
    if (!el) return null
    const b = el.getBoundingClientRect()
    return { left: b.left, top: b.top, w: b.width, h: b.height }
  }

  // Run until the curtain has been gone for a few frames.
  let goneFor = 0
  for (let i = 0; i < 2000 && goneFor < 5; i++) {
    await frame()
    const curtain = document.querySelector('[data-testid="intro-curtain"]')
    if (!curtain) goneFor++

    const piece = document.querySelector('[data-intro-piece="logo"]')
    const target = document.querySelector('header [data-logo-mark]')
    const titlePiece = document.querySelector('[data-intro-piece="title"]')
    const titleTarget = document.querySelector('[data-hero-title]')

    samples.push({
      t: +(performance.now() - t0).toFixed(1),
      curtain: curtain ? 1 : 0,
      owned: document.documentElement.hasAttribute('data-intro-owns-lockup') ? 1 : 0,
      clientWidth: document.documentElement.clientWidth,
      logoPiece: rect(piece),
      logoTarget: rect(target),
      titlePiece: rect(titlePiece),
      titleTarget: rect(titleTarget),
    })
  }
  return samples
})

const n = (v) => (v == null ? '' : (Math.round(v * 100) / 100).toFixed(2))
const pair = (p, t, k) => (p && t ? n(p[k] - t[k]) : '')

const header = [
  't_ms',
  'curtain',
  'owned',
  'clientW',
  'logo_piece_left', 'logo_piece_top', 'logo_piece_w', 'logo_piece_h',
  'logo_hdr_left', 'logo_hdr_top', 'logo_hdr_w', 'logo_hdr_h',
  'logo_dleft', 'logo_dtop', 'logo_dw', 'logo_dh',
  'title_piece_left', 'title_piece_top', 'title_piece_w', 'title_piece_h',
  'title_tgt_left', 'title_tgt_top', 'title_tgt_w', 'title_tgt_h',
  'title_dleft', 'title_dtop', 'title_dw', 'title_dh',
].join(',')

const lines = rows.map((r) => {
  const { logoPiece: lp, logoTarget: lt, titlePiece: tp, titleTarget: tt } = r
  return [
    r.t, r.curtain, r.owned, r.clientWidth,
    n(lp?.left), n(lp?.top), n(lp?.w), n(lp?.h),
    n(lt?.left), n(lt?.top), n(lt?.w), n(lt?.h),
    pair(lp, lt, 'left'), pair(lp, lt, 'top'), pair(lp, lt, 'w'), pair(lp, lt, 'h'),
    n(tp?.left), n(tp?.top), n(tp?.w), n(tp?.h),
    n(tt?.left), n(tt?.top), n(tt?.w), n(tt?.h),
    pair(tp, tt, 'left'), pair(tp, tt, 'top'), pair(tp, tt, 'w'), pair(tp, tt, 'h'),
  ].join(',')
})

writeFileSync(out, [header, ...lines].join('\n'))

// The frame the flight ends on: the last one where the piece still existed.
const flown = rows.filter((r) => r.logoPiece?.w > 0 && r.logoTarget)
const last = flown[flown.length - 1]
if (last) {
  const d = (p, t) => ({
    left: +(p.left - t.left).toFixed(2),
    top: +(p.top - t.top).toFixed(2),
    w: +(p.w - t.w).toFixed(2),
    h: +(p.h - t.h).toFixed(2),
  })
  // Frames where the travelling piece and the real element were BOTH on
  // screen. Must be zero: the two never rasterise identically, so any overlap
  // at all shows as a 1-2px doubled edge.
  // `curtain` alone is not enough: the handover hides the curtain outright and
  // React unmounts it a frame later, so it can be in the DOM while drawing
  // nothing. A zero-width rect is the signal for that.
  const overlap = rows.filter((r) => r.logoPiece?.w > 0 && r.owned === 0).length
  console.log(`${out}: ${rows.length} frames`)
  console.log('overlap frames (piece + real together):', overlap)
  console.log('landing delta  logo :', JSON.stringify(d(last.logoPiece, last.logoTarget)))
  if (last.titlePiece && last.titleTarget)
    console.log('landing delta  title:', JSON.stringify(d(last.titlePiece, last.titleTarget)))
  console.log('clientWidth first/last:', rows[0].clientWidth, '/', rows[rows.length - 1].clientWidth)
}

await browser.close()
