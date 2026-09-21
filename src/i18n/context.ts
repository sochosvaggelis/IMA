import { createContext } from 'react'
import type { Dictionary } from './dictionaries/el'

export const LANGUAGES = ['el', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

export const LANGUAGE_LABELS: Record<Language, string> = {
  el: 'Ελληνικά',
  en: 'English',
}

/** No setter: the language is whatever the URL says, so it changes by
    navigating (see LanguageSwitcher), not by calling a function. */
export type I18nValue = {
  lang: Language
  t: Dictionary
}

export const I18nContext = createContext<I18nValue | null>(null)
