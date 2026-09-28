/**
 * Row shapes of the content tables, as the REST API returns them.
 *
 * Mirrors supabase/migrations — change the two together. Columns the site
 * never reads (created_at, updated_at) are left out; they arrive anyway and
 * are simply ignored.
 */

/** The three levels on /services; a project's badge is one of them. */
export type ServiceLevel = 'component' | 'systems' | 'retrofit'

/**
 * One photo, as two files in the media bucket: `full` for the viewer and
 * `thumb` for grids. Paths, not URLs — see photoUrl() in ./backend. The
 * dimensions are the full file's, so boxes can be sized before it arrives.
 */
export type Photo = {
  full: string
  thumb: string
  w: number
  h: number
}

type Row = {
  id: string
  /** Display order, ascending. */
  position: number
  published: boolean
}

type WithPhotos = {
  /** First one is the cover. */
  photos: Photo[]
}

export type Project = Row & WithPhotos & {
  scope: ServiceLevel
  title_el: string
  title_en: string
  vessel_el: string
  vessel_en: string
  location_el: string
  location_en: string
  problem_el: string
  problem_en: string
  solution_el: string
  solution_en: string
  downtime_el: string
  downtime_en: string
}

export type SparePart = Row & WithPhotos & {
  title_el: string
  title_en: string
  manufacturer: string
  model: string
  description_el: string
  description_en: string
}

/** One group on /capabilities: a heading and the makers under it. */
export type CapabilityGroup = Row & {
  title_el: string
  title_en: string
  /** In display order. Not translated. */
  brands: string[]
}

/** One card on /certifications. */
export type Certification = Row & {
  /** The body or standard — "DNV", "ISO 9001:2015". Not translated. */
  name: string
  detail_el: string
  detail_en: string
}

/** primary: "Permanent presence"; secondary: "Regular coverage". */
export type CoverageTier = 'primary' | 'secondary'

/** One Greek port listed on /coverage. */
export type Port = Row & {
  tier: CoverageTier
  title_el: string
  title_en: string
}

export type Tables = {
  projects: Project
  spare_parts: SparePart
  capability_groups: CapabilityGroup
  certifications: Certification
  ports: Port
}

export type Table = keyof Tables
