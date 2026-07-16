import { LANGUAGES, LANGUAGE_LABELS } from '@/i18n/context'
import { useI18n } from '@/i18n/useI18n'
import { cn } from '@/lib/cn'

/**
 * Two languages only, so a segmented toggle beats a dropdown — one tap,
 * and both options stay visible.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useI18n()

  return (
    <div
      className={cn('border-navy-700 inline-flex items-center rounded-md border p-0.5', className)}
    >
      {LANGUAGES.map((code) => {
        const active = code === lang
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={active}
            aria-label={LANGUAGE_LABELS[code]}
            className={cn(
              'min-h-8 rounded px-2.5 font-mono text-xs uppercase transition-colors',
              active
                ? 'bg-signal-500 text-navy-950 font-semibold'
                : 'text-navy-400 hover:text-navy-100',
            )}
          >
            {code}
          </button>
        )
      })}
    </div>
  )
}
