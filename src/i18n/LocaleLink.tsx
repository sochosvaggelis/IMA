/**
 * Drop-in replacements for react-router's Link and NavLink that prefix the
 * target with the current language.
 *
 * Doing it here rather than at every call site means components keep passing
 * plain route constants (`ROUTES.services`) and cannot forget the prefix —
 * a forgotten one would silently throw a Greek reader back into English.
 */
import type { ComponentProps } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useI18n } from './useI18n'
import { localePath } from './localePath'

export function LocaleLink({ to, ...rest }: ComponentProps<typeof Link> & { to: string }) {
  const { lang } = useI18n()
  return <Link to={localePath(lang, to)} {...rest} />
}

export function LocaleNavLink({ to, ...rest }: ComponentProps<typeof NavLink> & { to: string }) {
  const { lang } = useI18n()
  return <NavLink to={localePath(lang, to)} {...rest} />
}
