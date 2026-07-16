import { createContext } from 'react'
import type { Dictionary } from './dictionaries/el'

export const LANGUAGES = ['el', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

export const LANGUAGE_LABELS: Record<Language, string> = {
  el: 'Ελληνικά',
  en: 'English',
}

export type I18nValue = {
  lang: Language
  setLang: (lang: Language) => void
  t: Dictionary
}

export const I18nContext = createContext<I18nValue | null>(null)
