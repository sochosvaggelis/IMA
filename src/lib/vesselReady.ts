/**
 * When the vessel is actually on screen.
 *
 * The GLB load and the edge extraction are the slow part of first paint — a few
 * hundred milliseconds of hashing every edge in a 200k-triangle hull, during
 * which the canvas is an empty sea. The intro curtain covers exactly that gap,
 * so it needs to hear about the moment the drawing exists.
 *
 * A module-level latch rather than context: the signal fires once per page
 * load, the curtain may well mount AFTER it (the model can come from the HTTP
 * cache on a repeat visit), and a subscriber arriving late must still be told.
 * `ready` is what makes that safe — subscribe resolves immediately if it has
 * already happened.
 */
let ready = false
const waiting = new Set<() => void>()

export function markVesselReady(): void {
  if (ready) return
  ready = true
  for (const fn of waiting) fn()
  waiting.clear()
}

/** Runs `fn` when the vessel is drawn — synchronously if it already is.
    Returns an unsubscribe for the not-yet case. */
export function onVesselReady(fn: () => void): () => void {
  if (ready) {
    fn()
    return () => {}
  }
  waiting.add(fn)
  return () => waiting.delete(fn)
}
