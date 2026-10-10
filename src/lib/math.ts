/**
 * The two easing helpers the hero's 2D code needs, without three.js.
 *
 * The same formulas as THREE.MathUtils.clamp and .smoothstep, so values are
 * identical either side of the split — the diagrams and the mobile feed use
 * these, while the 3D scene (VesselCanvas.tsx) keeps using three's own, and
 * the two must agree on every scroll position.
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** 0 at or below `min`, 1 at or above `max`, eased in between. */
export function smoothstep(x: number, min: number, max: number): number {
  if (x <= min) return 0
  if (x >= max) return 1
  const t = (x - min) / (max - min)
  return t * t * (3 - 2 * t)
}
