import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nContext, LANGUAGES, type Language } from './context'
import { el } from './dictionaries/el'
import { en } from './dictionaries/en'

const DICTIONARIES = { el, en }
const STORAGE_KEY = 'ima.lang'

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

function detectInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLanguage(stored)) return stored
  } catch {
    // Private mode / disabled storage — fall through to browser detection.
  }
  return navigator.language?.toLowerCase().startsWith('el') ? 'el' : 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(detectInitialLanguage)

  const setLang = useCallback((next: Language) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Non-fatal: the choice just won't survive a reload.
    }
  }, [])

  // Screen readers and search engines both read this off the root element.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const t = DICTIONARIES[lang]

  useEffect(() => {
    document.title = t.meta.title
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t.meta.description)
  }, [t])

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <I18nContext value={value}>{children}</I18nContext>
}
