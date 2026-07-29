/**
 * Turn a real equirectangular Earth photo into a "blueprint" coastline texture:
 * classify every pixel land/water, trace the boundary between them, and paint
 * that boundary as thin cyan lines on a transparent canvas. The output is an
 * equirectangular PNG that wraps straight onto the globe.
 *
 *   node scripts/bake-coastline.mjs <earth.jpg> [out.png]
 *
 * The edge detection runs in a headless Chromium (already present via
 * Playwright), so there are no image-decoding dependencies to install.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const src = process.argv[2]
const out =
  process.argv[3] ||
  new URL('../src/assets/earth-blueprint.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

if (!src) {
  console.error('usage: node scripts/bake-coastline.mjs <earth.jpg> [out.png]')
  process.exit(1)
}

const ext = src.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
const dataUrl = `data:image/${ext};base64,${readFileSync(src).toString('base64')}`

const browser = await chromium.launch()
const page = await browser.newPage()

const outUrl = await page.evaluate(
  async ({ dataUrl, W, H, denoisePasses, minComponent, dilate, blur }) => {
    const img = new Image()
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = rej
      img.src = dataUrl
    })

    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d')
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'high'
    g.drawImage(img, 0, 0, W, H)
    const { data } = g.getImageData(0, 0, W, H)

    // Land vs water. On a cloud-free Blue Marble, ocean is blue-dominant; land
    // is green/brown and ice is near-white — both fail the "blue wins" test.
    let land = new Uint8Array(W * H)
    for (let i = 0; i < W * H; i++) {
      const r = data[i * 4]
      const gg = data[i * 4 + 1]
      const b = data[i * 4 + 2]
      const water = b > r && b > gg && b > 35
      land[i] = water ? 0 : 1
    }

    // Majority filter (longitude wraps, latitude clamps): a pixel takes the
    // vote of its 3x3 neighbourhood. This is what smooths the coastline and
    // erases the speckle where ice/snow/high terrain misread as land — the
    // isolated dots lose the vote, tiny holes get filled, jagged edges round.
    const vote = (src) => {
      const dst = new Uint8Array(W * H)
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let count = 0
          for (let dy = -1; dy <= 1; dy++) {
            const yy = Math.min(H - 1, Math.max(0, y + dy))
            for (let dx = -1; dx <= 1; dx++) {
              count += src[yy * W + ((x + dx + W) % W)]
            }
          }
          dst[y * W + x] = count >= 5 ? 1 : 0
        }
      }
      return dst
    }
    for (let p = 0; p < denoisePasses; p++) land = vote(land)

    // Boundary = a land pixel touching water.
    const at = (x, y) => land[Math.min(H - 1, Math.max(0, y)) * W + ((x + W) % W)]
    const edge = new Uint8Array(W * H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!land[y * W + x]) continue
        if (at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1)) continue
        edge[y * W + x] = 1
      }
    }

    // Keep only substantial coastline runs. Continents are one big connected
    // contour of thousands of pixels; the leftover Arctic-ice speckle and stray
    // ocean dots are tiny disconnected fragments. Flood-fill each fragment
    // (8-connected, longitude wraps) and erase any smaller than minComponent.
    const seen = new Uint8Array(W * H)
    const stack = new Int32Array(W * H)
    for (let s = 0; s < W * H; s++) {
      if (!edge[s] || seen[s]) continue
      let top = 0
      stack[top++] = s
      seen[s] = 1
      const members = [s]
      while (top > 0) {
        const p = stack[--top]
        const px = p % W
        const py = (p / W) | 0
        for (let dy = -1; dy <= 1; dy++) {
          const yy = py + dy
          if (yy < 0 || yy >= H) continue
          for (let dx = -1; dx <= 1; dx++) {
            const q = yy * W + ((px + dx + W) % W)
            if (edge[q] && !seen[q]) {
              seen[q] = 1
              stack[top++] = q
              members.push(q)
            }
          }
        }
      }
      if (members.length < minComponent) for (const q of members) edge[q] = 0
    }

    // Paint hard edge pixels (slightly dilated), then composite that layer onto
    // the output through a small blur so the lines land as smooth, faintly
    // glowing strokes rather than aliased dots — with one sharp pass on top to
    // keep a defined core.
    const ec = document.createElement('canvas')
    ec.width = W
    ec.height = H
    const eg = ec.getContext('2d')
    const ed = eg.createImageData(W, H)
    const col = [122, 228, 243] // signal-300
    const paint = (x, y) => {
      const j = (Math.min(H - 1, Math.max(0, y)) * W + ((x + W) % W)) * 4
      ed.data[j] = col[0]
      ed.data[j + 1] = col[1]
      ed.data[j + 2] = col[2]
      ed.data[j + 3] = 255
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!edge[y * W + x]) continue
        for (let dy = -dilate; dy <= dilate; dy++) {
          for (let dx = -dilate; dx <= dilate; dx++) paint(x + dx, y + dy)
        }
      }
    }
    eg.putImageData(ed, 0, 0)

    const oc = document.createElement('canvas')
    oc.width = W
    oc.height = H
    const og = oc.getContext('2d')
    og.filter = `blur(${blur}px)`
    og.drawImage(ec, 0, 0)
    og.filter = 'none'
    og.globalAlpha = 0.55
    og.drawImage(ec, 0, 0)
    og.globalAlpha = 1
    return oc.toDataURL('image/png')
  },
  { dataUrl, W: 2048, H: 1024, denoisePasses: 2, minComponent: 40, dilate: 1, blur: 1.1 },
)

await browser.close()

const b64 = outUrl.replace(/^data:image\/png;base64,/, '')
writeFileSync(out, Buffer.from(b64, 'base64'))
console.log(`wrote ${out}`)
