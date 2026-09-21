import { useEffect, useMemo, type ReactNode } from 'react'
import { I18nContext, type Language } from './context'
import { el } from './dictionaries/el'
import { en } from './dictionaries/en'

const DICTIONARIES = { el, en }

/**
 * Supplies the dictionary for the language the URL asked for.
 *
 * The language is a prop, passed down from the route tree in App.tsx, rather
 * than state detected from the browser and remembered in localStorage. The URL
 * is now the single source of truth: /services is English and /el/services is
 * Greek, for every visitor and every crawler alike.
 *
 * That also means nothing is stored on the visitor's device any more — which
 * is why the privacy policy can say the site stores nothing at all.
 */
export function LanguageProvider({ lang, children }: { lang: Language; children: ReactNode }) {
  // Screen readers and search engines both read this off the root element.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // Title and description are NOT set here: they vary by route as well as by
  // language, so usePageMeta owns them from inside the router.

  const value = useMemo(() => ({ lang, t: DICTIONARIES[lang] }), [lang])

  return <I18nContext value={value}>{children}</I18nContext>
}
