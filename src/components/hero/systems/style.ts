/**
 * Drawing conventions shared by every system diagram.
 *
 * Kept apart from the symbols themselves so that file exports components only
 * — mixing constants and components in one module breaks fast refresh.
 *
 * The weights encode a hierarchy: a busbar should read heavier than the
 * conductor tapped off it, and a control signal lighter than either. Keeping
 * that consistent across nine drawings is what makes them look like one set.
 */
export const STROKE = {
  bus: 2.6,
  equipment: 1.4,
  conductor: 1.2,
  signal: 0.9,
} as const

export const TYPE = {
  tag: 8.5,
  sub: 7,
  glyph: 10,
} as const
