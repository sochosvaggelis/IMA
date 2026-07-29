/**
 * World coastlines, as an array of polylines. Each polyline is a run of
 * [longitude, latitude] pairs in degrees; the globe projects them onto the
 * sphere and draws them as continent outlines.
 *
 * Generated from Natural Earth 1:110m coastline data (public domain) and
 * simplified for a low line-count that still reads as the world at this size.
 * Regenerate with scripts/gen-coastline.mjs.
 */
export type CoastlinePath = [number, number][]

export const COASTLINE: CoastlinePath[] = []
