import { use } from 'react'
import { I18nContext } from './context'

export function useI18n() {
  const value = use(I18nContext)
  if (!value) throw new Error('useI18n must be used inside <LanguageProvider>')
  return value
}
