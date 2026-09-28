/**
 * What the admin panel can edit, described as data.
 *
 * The list and editor screens are generic: they render whatever a Collection
 * here describes. Making another piece of the site editable (certifications,
 * coverage ports, …) is a table in supabase/migrations, a type in
 * src/content/types.ts, and an entry here — no new screens.
 */
import { en } from '@/i18n/dictionaries/en'
import { ROUTES } from '@/routes'
import type { Photo, ServiceLevel, Table } from '@/content/types'

/** A row as the editor holds it: loosely typed, since the fields vary. */
export type Row = {
  id?: string
  position?: number
  published: boolean
  /** Only on collections with a photos field. */
  photos?: Photo[]
  [column: string]: unknown
}

/** Text in both languages: stored as `<name>_el` and `<name>_en`. */
type LocalisedField = {
  kind: 'localised'
  name: string
  label: string
  hint?: string
  multiline?: boolean
  /** At least one language must be filled in; the site falls back to it. */
  required?: boolean
}

/** One value for both languages — a maker's name, a part number. */
type TextField = {
  kind: 'text'
  name: string
  label: string
  hint?: string
  /** Offer the values already used in this column, so "ABB" stays "ABB". */
  suggest?: boolean
  required?: boolean
}

type SelectField = {
  kind: 'select'
  name: string
  label: string
  hint?: string
  options: readonly { value: string; label: string }[]
}

/** A list of short values, the same in both languages — the makers in a
    capabilities group. Edited as removable, reorderable chips. */
type ListField = {
  kind: 'list'
  name: string
  label: string
  hint?: string
  /** What one entry is called: "Add a maker". */
  item: string
  required?: boolean
}

type PhotosField = {
  kind: 'photos'
  name: 'photos'
  label: string
  hint?: string
  required?: boolean
}

export type Field = LocalisedField | TextField | SelectField | ListField | PhotosField

export type Collection = {
  table: Table
  /** URL segment under /admin. */
  slug: string
  /** Plural, for headings and the nav. */
  title: string
  /** Singular and lower-case, for "Add a …" / "Delete this …". */
  noun: string
  /** Where the published rows appear on the site. */
  publicPath: string
  /** Shown above the list — anything the owner should know about ordering. */
  note?: string
  fields: readonly Field[]
  /** Second line in the list: whatever tells two rows apart at a glance. */
  describe: (row: Row) => string
}

const text = (row: Row, column: string) => (typeof row[column] === 'string' ? row[column] : '')

export const SPARE_PARTS: Collection = {
  table: 'spare_parts',
  slug: 'spare-parts',
  title: 'Spare parts',
  noun: 'spare part',
  publicPath: ROUTES.spareParts,
  fields: [
    {
      kind: 'photos',
      name: 'photos',
      label: 'Photos',
      required: true,
      hint: 'The first photo is the one shown in the grid. On a phone you can take them straight from the camera.',
    },
    {
      kind: 'localised',
      name: 'title',
      label: 'What is it?',
      required: true,
      hint: 'A short name, e.g. “Drive control board” / “Πλακέτα ελέγχου drive”.',
    },
    { kind: 'text', name: 'manufacturer', label: 'Manufacturer', suggest: true, hint: 'Optional.' },
    { kind: 'text', name: 'model', label: 'Model / part number', hint: 'Optional.' },
    {
      kind: 'localised',
      name: 'description',
      label: 'Description',
      multiline: true,
      hint: 'Optional — what was wrong with it and what you did.',
    },
  ],
  describe: (row) => [text(row, 'manufacturer'), text(row, 'model')].filter(Boolean).join(' · '),
}

const SCOPES: readonly ServiceLevel[] = ['component', 'systems', 'retrofit']

export const PROJECTS: Collection = {
  table: 'projects',
  slug: 'projects',
  title: 'Projects',
  noun: 'project',
  publicPath: ROUTES.projects,
  note: 'The first two published projects also appear on the home page.',
  fields: [
    { kind: 'localised', name: 'title', label: 'Title', required: true },
    {
      kind: 'select',
      name: 'scope',
      label: 'Scope',
      // The site's own labels, so the admin shows exactly what visitors see.
      options: SCOPES.map((value) => ({ value, label: en.projects.scopes[value] })),
    },
    { kind: 'localised', name: 'vessel', label: 'Vessel type', required: true },
    { kind: 'localised', name: 'location', label: 'Location', required: true },
    { kind: 'localised', name: 'problem', label: 'Problem', required: true, multiline: true },
    { kind: 'localised', name: 'solution', label: 'Solution', required: true, multiline: true },
    { kind: 'localised', name: 'downtime', label: 'Turnaround', required: true, hint: 'e.g. “11 hours”.' },
    { kind: 'photos', name: 'photos', label: 'Photos', hint: 'Optional. The first photo is shown first.' },
  ],
  describe: (row) =>
    [text(row, 'vessel_en') || text(row, 'vessel_el'), text(row, 'location_en') || text(row, 'location_el')]
      .filter(Boolean)
      .join(' · '),
}

const list = (row: Row, column: string) => (Array.isArray(row[column]) ? (row[column] as string[]) : [])

export const CAPABILITIES: Collection = {
  table: 'capability_groups',
  slug: 'capabilities',
  title: 'Capabilities',
  noun: 'group',
  publicPath: ROUTES.capabilities,
  note: 'Each group is a heading on the Capabilities page, with its makers listed beneath it.',
  fields: [
    {
      kind: 'localised',
      name: 'title',
      label: 'Group name',
      required: true,
      hint: 'e.g. “Automation & control” / “Αυτοματισμοί & έλεγχος”.',
    },
    {
      kind: 'list',
      name: 'brands',
      label: 'Makers',
      item: 'maker',
      required: true,
      hint: 'Type a name and press Enter. They appear on the site in this order.',
    },
  ],
  describe: (row) => {
    const brands = list(row, 'brands')
    const shown = brands.slice(0, 4).join(', ')
    return brands.length > 4 ? `${shown} and ${brands.length - 4} more` : shown
  },
}

export const CERTIFICATIONS: Collection = {
  table: 'certifications',
  slug: 'certifications',
  title: 'Certifications',
  noun: 'certification',
  publicPath: ROUTES.certifications,
  note: 'Each one is a card on the Certifications page. List only approvals IMA actually holds.',
  fields: [
    {
      kind: 'text',
      name: 'name',
      label: 'Name',
      required: true,
      hint: 'The class society or standard, e.g. “DNV” or “ISO 9001:2015”. Same in both languages.',
    },
    {
      kind: 'localised',
      name: 'detail',
      label: 'What it covers',
      required: true,
      hint: 'e.g. “Approved service supplier” / “Αναγνωρισμένος πάροχος υπηρεσιών”.',
    },
  ],
  describe: (row) => text(row, 'detail_en') || text(row, 'detail_el'),
}

export const COVERAGE: Collection = {
  table: 'ports',
  slug: 'coverage',
  title: 'Coverage',
  noun: 'port',
  publicPath: ROUTES.coverage,
  note: 'The ports listed on the Coverage page, under the heading chosen for each. The globe’s routes are a drawing and do not change.',
  fields: [
    { kind: 'localised', name: 'title', label: 'Port', required: true, hint: 'e.g. “Piraeus” / “Πειραιάς”.' },
    {
      kind: 'select',
      name: 'tier',
      label: 'Listed under',
      // The page's own headings, so the choice reads exactly as visitors see it.
      options: [
        { value: 'primary', label: en.coverage.primary },
        { value: 'secondary', label: en.coverage.secondary },
      ],
    },
  ],
  describe: (row) => (row.tier === 'primary' ? en.coverage.primary : en.coverage.secondary),
}

export const COLLECTIONS: readonly Collection[] = [SPARE_PARTS, PROJECTS, CAPABILITIES, CERTIFICATIONS, COVERAGE]

/** Whether rows of this collection carry photos at all. */
export const hasPhotos = (collection: Collection) => collection.fields.some((f) => f.kind === 'photos')

/** A blank row for the "new" screen: every field empty, published by default
    — what you save is what goes live, unless you switch it off first. */
export function blankRow(collection: Collection): Row {
  // Only the collection's own columns: an insert naming a column the table
  // does not have (photos, on capability groups) is refused outright.
  const row: Row = { published: true }
  for (const field of collection.fields) {
    if (field.kind === 'localised') {
      row[`${field.name}_el`] = ''
      row[`${field.name}_en`] = ''
    } else if (field.kind === 'text') {
      row[field.name] = ''
    } else if (field.kind === 'select') {
      row[field.name] = field.options[0].value
    } else {
      row[field.name] = []
    }
  }
  return row
}

/** The row's title for lists and messages, in whichever language it has —
    or its untranslated name, for rows that have one instead (certifications). */
export function titleOf(row: Row): string {
  return text(row, 'title_en') || text(row, 'title_el') || text(row, 'name') || 'Untitled'
}
