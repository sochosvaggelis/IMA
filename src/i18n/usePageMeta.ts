/**
 * Keeps <title>, the description, the canonical URL and the og:/twitter:
 * pairs in step with the current route AND the current language, and emits
 * the hreflang alternates that tie the two language versions together.
 *
 * The site is a client-rendered SPA: every route is served the same
 * index.html, so without this every page would share one title and one
 * description, and a search result for /coverage would read exactly like one
 * for /contact. Crawlers do execute the JavaScript, so rewriting the tags
 * after mount is enough — but it has to happen in ONE place, or two effects
 * end up fighting over document.title.
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ROUTES } from '@/routes'
import { useI18n } from './useI18n'
import { LANGUAGES } from './context'
import { localePath, parseLocalePath } from './localePath'
import type { Dictionary } from './dictionaries/el'

/** Absolute URLs are required for canonical and hreflang — relative ones are ignored. */
const SITE_ORIGIN = 'https://imagreece.gr'

type MetaKey = keyof Dictionary['pageMeta']

/** Un-prefixed path -> dictionary key. Anything unmatched (a 404) falls to `notFound`. */
const BY_PATH: Record<string, MetaKey> = {
  [ROUTES.home]: 'home',
  [ROUTES.services]: 'services',
  [ROUTES.capabilities]: 'capabilities',
  [ROUTES.projects]: 'projects',
  [ROUTES.certifications]: 'certifications',
  [ROUTES.coverage]: 'coverage',
  [ROUTES.contact]: 'contact',
  [ROUTES.privacy]: 'privacy',
}

/** Sets an existing tag's attribute, creating the tag if index.html lacks it. */
function setTag(selector: string, create: () => HTMLElement, attribute: string, value: string) {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = create()
    document.head.appendChild(element)
  }
  element.setAttribute(attribute, value)
}

function setLink(selector: string, rel: string, href: string, hreflang?: string) {
  setTag(
    selector,
    () => {
      const link = document.createElement('link')
      link.setAttribute('rel', rel)
      if (hreflang) link.setAttribute('hreflang', hreflang)
      return link
    },
    'href',
    href,
  )
}

function setMeta(property: string, value: string) {
  setTag(
    `meta[property="${property}"]`,
    () => {
      const meta = document.createElement('meta')
      meta.setAttribute('property', property)
      return meta
    },
    'content',
    value,
  )
}

export function usePageMeta() {
  const { pathname } = useLocation()
  const { t, lang } = useI18n()

  useEffect(() => {
    // The router gives us the full path including /el; the dictionary is keyed
    // by the route underneath it.
    const { path } = parseLocalePath(pathname)
    const key = BY_PATH[path] ?? 'notFound'
    const { title, description } = t.pageMeta[key]

    // A 404 must never present itself to a crawler as a canonical page.
    const canonicalPath = key === 'notFound' ? localePath(lang, ROUTES.home) : pathname
    const canonical = `${SITE_ORIGIN}${canonicalPath}`

    document.title = title

    setTag(
      'meta[name="description"]',
      () => Object.assign(document.createElement('meta'), { name: 'description' }),
      'content',
      description,
    )
    setLink('link[rel="canonical"]', 'canonical', canonical)

    // hreflang: each language's URL for THIS page, plus x-default pointing at
    // English, which owns the bare paths. Every page must list every version
    // including itself, or search engines ignore the set entirely.
    for (const code of LANGUAGES) {
      const href = `${SITE_ORIGIN}${localePath(code, key === 'notFound' ? ROUTES.home : path)}`
      setLink(`link[rel="alternate"][hreflang="${code}"]`, 'alternate', href, code)
    }
    setLink(
      'link[rel="alternate"][hreflang="x-default"]',
      'alternate',
      `${SITE_ORIGIN}${key === 'notFound' ? ROUTES.home : path}`,
      'x-default',
    )

    setMeta('og:title', title)
    setMeta('og:description', description)
    setMeta('og:url', canonical)
    setMeta('og:locale', lang === 'el' ? 'el_GR' : 'en_US')
  }, [pathname, t, lang])
}
