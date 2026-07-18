/**
 * Deterministic mode for visual-regression tests, switched on with `?e2e=1`.
 *
 * Screenshot comparison needs every run of the same scroll position to paint
 * the same pixels, and three things in the hero deliberately prevent that in
 * normal use: the seakeeping and sea drift run on a free clock, the marker
 * pulse loops on its own period, and the scene EASES toward the scroll
 * position rather than tracking it. Under this flag all three collapse to a
 * single fixed state per scroll position — the tests then compare like with
 * like, and a diff means the layout actually changed.
 *
 * Read once at module load: the flag is set by the test runner in the URL it
 * navigates to, never toggled mid-session.
 */
export const E2E =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('e2e')
