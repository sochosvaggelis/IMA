/**
 * Language lives in the URL, not in localStorage.
 *
 * English owns the bare paths (/services) and Greek is prefixed (/el/services).
 * That is the whole point of the scheme: a crawler that fetches /el/services
 * gets Greek every time, so the Greek pages can actually be indexed — which
 * they could not be when the language was decided by the visitor's browser and
 * every URL served whatever that happened to be.
 *
 * There are deliberately NO redirects between the two. A redirect would also
 * catch Googlebot and undo exactly what this is for.
 */
import { type Language } from './context'

/** The Greek URL prefix. English has none — it is the default language. */
export const EL_PREFIX = '/el'

/**
 * Turns an un-prefixed route into the URL for `lang`.
 * Query strings ride along untouched, so '/contact?urgency=emergency' works.
 */
export function localePath(lang: Language, path: string): string {
  if (lang === 'en') return path
  return path === '/' ? EL_PREFIX : `${EL_PREFIX}${path}`
}

/**
 * The inverse: splits a real pathname into the language it encodes and the
 * route underneath. '/el/services' -> { lang: 'el', path: '/services' }.
 *
 * Note '/el' matches but '/element' does not — the prefix has to be a whole
 * path segment.
 */
export function parseLocalePath(pathname: string): { lang: Language; path: string } {
  if (pathname === EL_PREFIX || pathname.startsWith(`${EL_PREFIX}/`)) {
    return { lang: 'el', path: pathname.slice(EL_PREFIX.length) || '/' }
  }
  return { lang: 'en', path: pathname }
}
