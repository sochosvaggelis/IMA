/**
 * What the hero page (VesselScene.tsx) and its WebGL scene (VesselCanvas.tsx)
 * both need. Separate so the page can share it without loading the scene.
 */

/** Where the mobile feed layout takes over. The same 1024px the CSS lg:
    breakpoint uses, so the camera's idea of the layout always matches the one
    on screen. Below it the canvas is a sticky strip at the top of the page and
    the systems scroll beneath it as a normal feed, not a snap runway. */
export const MOBILE_LAYOUT_WIDTH = 1024

/** A value shared between the scroll handlers and the frame loop by ref. */
export type Progress = { current: number }
