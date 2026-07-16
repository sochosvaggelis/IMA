import { useI18n } from '@/i18n/useI18n'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { ButtonLink } from '@/components/ui/Button'
import { ROUTES } from '@/routes'

export default function Coverage() {
  const { t } = useI18n()
  const primary = t.coverage.ports.filter((p) => p.tier === 'primary')
  const secondary = t.coverage.ports.filter((p) => p.tier === 'secondary')

  return (
    <>
      <PageHeader eyebrow={t.coverage.eyebrow} title={t.coverage.title} intro={t.coverage.intro} />

      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-navy-200 flex items-center gap-2.5 text-h3 font-semibold">
              <span className="bg-signal-400 size-2.5 rounded-full" aria-hidden="true" />
              {t.coverage.primary}
            </h2>
            <ul className="mt-6 space-y-3">
              {primary.map((port) => (
                <li
                  key={port.name}
                  className="border-signal-500/30 bg-signal-500/5 text-white flex min-h-14 items-center rounded-md border px-5 font-medium"
                >
                  {port.name}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-navy-200 flex items-center gap-2.5 text-h3 font-semibold">
              <span className="bg-navy-500 size-2.5 rounded-full" aria-hidden="true" />
              {t.coverage.secondary}
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {secondary.map((port) => (
                <li
                  key={port.name}
                  className="border-navy-800 bg-navy-900/40 text-navy-300 flex min-h-14 items-center rounded-md border px-5 text-sm"
                >
                  {port.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section tone="raised">
        <div className="max-w-2xl">
          <h2 className="text-h2 font-semibold text-balance text-white">
            {t.coverage.worldwide.title}
          </h2>
          <p className="text-navy-300 mt-5 text-base leading-relaxed sm:text-lg">
            {t.coverage.worldwide.body}
          </p>
          <div className="mt-8">
            <ButtonLink to={ROUTES.contact} variant="alert" size="lg">
              {t.home.ctaBand.cta}
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  )
}
