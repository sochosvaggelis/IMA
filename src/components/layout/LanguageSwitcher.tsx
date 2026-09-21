import { Link, useLocation } from 'react-router-dom'
import { LANGUAGES, LANGUAGE_LABELS } from '@/i18n/context'
import { useI18n } from '@/i18n/useI18n'
import { localePath, parseLocalePath } from '@/i18n/localePath'
import { cn } from '@/lib/cn'

/**
 * Two languages only, so a segmented toggle beats a dropdown — one tap,
 * and both options stay visible.
 *
 * These are real links, not buttons, and that is the point: they are the
 * crawlable path from the English pages to the Greek ones. A button that
 * swapped a dictionary in place would leave the Greek content with no URL
 * for a search engine to follow, which is the problem this whole scheme
 * exists to fix.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang } = useI18n()
  const { pathname, search } = useLocation()
  // Swap only the language segment — whoever is reading /coverage should land
  // on /el/coverage, not back at the home page.
  const { path } = parseLocalePath(pathname)

  return (
    <div
      className={cn('border-navy-700 inline-flex items-center rounded-md border p-0.5', className)}
    >
      {LANGUAGES.map((code) => {
        const active = code === lang
        return (
          <Link
            key={code}
            to={`${localePath(code, path)}${search}`}
            hrefLang={code}
            aria-current={active ? 'true' : undefined}
            aria-label={LANGUAGE_LABELS[code]}
            className={cn(
              'min-h-8 rounded px-2.5 font-mono text-xs uppercase transition-colors',
              'inline-flex items-center justify-center',
              active
                ? 'bg-signal-500 text-navy-950 font-semibold'
                : 'text-navy-400 hover:text-navy-100',
            )}
          >
            {code}
          </Link>
        )
      })}
    </div>
  )
}
