/**
 * Renders public/og-image.png — the 1200x630 card shown when a link to the
 * site is pasted into WhatsApp, LinkedIn, Slack or a search result preview.
 *
 * Run: node scripts/og-image.mjs
 *
 * It is a build-once asset, committed to the repo rather than generated at
 * deploy time: the crawlers that fetch it will not run our build, and it only
 * needs redoing when the branding or the strap line changes.
 *
 * Colours here are hex approximations of the oklch tokens in src/index.css —
 * a headless screenshot has no design system to read from. If the palette
 * moves, move these with it.
 */
import { chromium } from '@playwright/test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'public', 'og-image.png')

/** Inlined, not linked: a page built with setContent has no origin, so the
    browser refuses to fetch file:// subresources and the logo silently
    renders as a blank gap. */
const logo = `data:image/png;base64,${readFileSync(
  path.join(root, 'public', 'logo-white.png'),
).toString('base64')}`

const NAVY = '#0b1220'
const SIGNAL = '#3fc1e0'
const ALERT = '#f0a44e'

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face {
        font-family: 'Inter';
        src: url('${pathToFileURL(path.join(root, 'src/assets/fonts/inter-latin.woff2')).href}') format('woff2');
        font-weight: 100 900;
      }
      * { margin: 0; box-sizing: border-box; }
      body {
        width: 1200px;
        height: 630px;
        background: ${NAVY};
        font-family: 'Inter', system-ui, sans-serif;
        color: #fff;
        position: relative;
        overflow: hidden;
      }
      /* The same blueprint grid the site uses, at the card's scale. */
      .grid {
        position: absolute; inset: 0;
        background-image:
          linear-gradient(to right, rgba(63,193,224,0.08) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(63,193,224,0.08) 1px, transparent 1px);
        background-size: 48px 48px;
      }
      .glow {
        position: absolute; inset: 0;
        background: radial-gradient(120% 90% at 78% 15%, rgba(63,193,224,0.16), transparent 60%);
      }
      .content { position: relative; padding: 72px 80px; height: 100%; display: flex; flex-direction: column; }
      /* align-self matters: the flex column stretches children to full width
         by default, which squashes this 153x160 emblem into an ellipse. */
      img { height: 78px; width: auto; align-self: flex-start; }
      .eyebrow {
        margin-top: 56px;
        font-size: 19px; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase;
        color: ${SIGNAL};
      }
      h1 { margin-top: 22px; font-size: 72px; line-height: 1.08; font-weight: 600; letter-spacing: -0.02em; }
      h1 span { display: block; color: ${SIGNAL}; }
      .foot { margin-top: auto; display: flex; align-items: center; gap: 18px; font-size: 23px; }
      .dot { width: 12px; height: 12px; border-radius: 999px; background: ${ALERT}; }
      .foot b { color: ${ALERT}; font-weight: 600; }
      .foot .sep { color: rgba(255,255,255,0.28); }
      .foot .dom { color: rgba(255,255,255,0.62); }
    </style>
  </head>
  <body>
    <div class="grid"></div>
    <div class="glow"></div>
    <div class="content">
      <img src="${logo}" alt="" />
      <p class="eyebrow">Marine Electrical · Electronics · Automation</p>
      <h1>Your vessel doesn't wait.<span>Neither do we.</span></h1>
      <div class="foot">
        <span class="dot"></span><b>24/7 breakdown response</b>
        <span class="sep">|</span><span class="dom">imagreece.gr</span>
      </div>
    </div>
  </body>
</html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: out })
await browser.close()
console.log('wrote', path.relative(root, out))
