import type { Language } from '@/i18n/context'

/** Field names that exist as a `_el`/`_en` pair on T: 'title' for title_el + title_en. */
export type LocalisedField<T> = {
  [K in keyof T]: K extends `${infer Base}_el` ? (`${Base}_en` extends keyof T ? Base : never) : never
}[keyof T]

/**
 * A row's text in `lang`, falling back to the other language when that one
 * was left empty — the admin panel allows saving with only one language
 * filled in, and a Greek sentence on the English page beats a blank.
 */
export function pick<T extends object>(row: T, field: LocalisedField<T>, lang: Language): string {
  const other: Language = lang === 'el' ? 'en' : 'el'
  const values = row as Record<string, unknown>
  const own = values[`${String(field)}_${lang}`]
  if (typeof own === 'string' && own.trim()) return own
  const fallback = values[`${String(field)}_${other}`]
  return typeof fallback === 'string' ? fallback : ''
}
