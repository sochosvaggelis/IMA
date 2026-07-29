/**
 * Generate src/components/coverage/worldCoastline.ts from Natural Earth 1:110m
 * coastline data (public domain).
 *
 *   node scripts/gen-coastline.mjs path/to/ne_110m_coastline.json
 *
 * Coordinates are rounded to one decimal (~11 km) and runs shorter than three
 * points are dropped — plenty of fidelity for a globe a few hundred px wide,
 * and it keeps the bundled module small.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/gen-coastline.mjs <ne_110m_coastline.json>')
  process.exit(1)
}

const geo = JSON.parse(readFileSync(src, 'utf8'))
const round = (n) => Math.round(n * 10) / 10

/** Flatten LineString / MultiLineString features to arrays of [lng,lat] runs. */
const paths = []
for (const feature of geo.features) {
  const { type, coordinates } = feature.geometry
  const runs = type === 'MultiLineString' ? coordinates : [coordinates]
  for (const run of runs) {
    const pts = run.map(([lng, lat]) => [round(lng), round(lat)])
    if (pts.length >= 3) paths.push(pts)
  }
}

const body = paths.map((p) => JSON.stringify(p)).join(',\n  ')

const out = `/**
 * World coastlines, as an array of polylines. Each polyline is a run of
 * [longitude, latitude] pairs in degrees; the globe projects them onto the
 * sphere and draws them as continent outlines.
 *
 * Generated from Natural Earth 1:110m coastline data (public domain) and
 * simplified for a low line-count that still reads as the world at this size.
 * Regenerate with scripts/gen-coastline.mjs.
 */
export type CoastlinePath = [number, number][]

export const COASTLINE: CoastlinePath[] = [
  ${body},
]
`

const dest = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'components',
  'coverage',
  'worldCoastline.ts',
)
writeFileSync(dest, out)
console.log(`wrote ${paths.length} coastline paths to ${dest}`)
