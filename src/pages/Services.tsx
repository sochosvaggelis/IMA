import { useI18n } from '@/i18n/useI18n'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section, SectionHeading } from '@/components/ui/Section'
import { ButtonLink } from '@/components/ui/Button'
import { ROUTES } from '@/routes'

function Check() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="text-signal-500 mt-0.5 size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Services() {
  const { t } = useI18n()

  return (
    <>
      <PageHeader eyebrow={t.services.eyebrow} title={t.services.title} intro={t.services.intro} />

      <Section>
        <div className="space-y-4 lg:space-y-6">
          {t.services.levels.map((level) => (
            // scroll-mt clears the fixed header when linked to by hash from home
            <article
              key={level.id}
              id={level.id}
              className="border-navy-800 bg-navy-900/40 scroll-mt-24 rounded-lg border p-6 sm:p-8 lg:p-10"
            >
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12">
                <div>
                  <span className="text-signal-500/70 font-mono text-sm">{level.index}</span>
                  <h2 className="text-h2 mt-3 font-semibold text-balance text-white">{level.name}</h2>
                  <p className="text-navy-300 mt-5 text-base leading-relaxed">{level.summary}</p>
                </div>

                <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:content-start">
                  {level.items.map((item) => (
                    <li key={item} className="text-navy-300 flex gap-3 text-sm leading-relaxed">
                      <Check />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section tone="raised">
        <SectionHeading title={t.services.where.title} />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {t.services.where.modes.map((mode) => (
            <div key={mode.name} className="border-navy-800 border-t pt-5">
              <h3 className="text-base font-semibold text-white">{mode.name}</h3>
              <p className="text-navy-400 mt-2 text-sm leading-relaxed">{mode.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <ButtonLink to={ROUTES.contact} variant="alert" size="lg">
            {t.home.ctaBand.cta}
          </ButtonLink>
        </div>
      </Section>
    </>
  )
}
