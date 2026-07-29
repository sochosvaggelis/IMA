import { useI18n } from '@/i18n/useI18n'
import { Container } from '@/components/ui/Container'
import { Section } from '@/components/ui/Section'
import { ButtonLink } from '@/components/ui/Button'
import { CoverageGlobe } from '@/components/coverage/CoverageGlobe'
import { ROUTES } from '@/routes'

export default function Coverage() {
  const { t } = useI18n()
  const reach = t.coverage.reach
  const primary = t.coverage.ports.filter((p) => p.tier === 'primary')
  const secondary = t.coverage.ports.filter((p) => p.tier === 'secondary')

  return (
    <div className="relative">
      {/* Blueprint texture across the top band, behind the globe. */}
      <div
        className="blueprint-grid pointer-events-none absolute inset-x-0 top-0 z-0 h-[48rem] opacity-40"
        aria-hidden="true"
      />

      {/* The globe is a page-level backdrop, not tied to any one section: faint
          and centred on mobile; on desktop a large sphere rising off the top,
          left of centre, bleeding down behind the coverage lists. It spins. */}
      <div
        className="pointer-events-none absolute top-16 left-1/2 z-0 w-[34rem] max-w-[150%] -translate-x-1/2 opacity-25 lg:top-30 lg:left-[-10rem] lg:w-[56rem] lg:max-w-none lg:translate-x-0 lg:opacity-100"
        aria-hidden="true"
      >
        <CoverageGlobe />
      </div>

      {/* All copy rides above the globe. */}
      <div className="relative z-10">
        {/* Global reach, up front: the page used to open on a list of Greek
            ports, reading as "we cover Greece". The globe says the opposite
            first; the copy is pulled clear to the right to stay legible. */}
        <section className="lg:min-h-[40rem]">
          <Container className="pt-28 pb-16 sm:pt-32 lg:pt-40 lg:pb-28">
            <div className="lg:ml-auto lg:max-w-2xl">
              <p className="eyebrow mb-4">{t.coverage.eyebrow}</p>
              <h1 className="text-h1 max-w-3xl text-balance font-semibold text-white">
                {t.coverage.title}
              </h1>
              <p className="text-navy-300 mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
                {t.coverage.intro}
              </p>

              <h2 className="text-h2 mt-14 font-semibold text-balance text-white">{reach.title}</h2>
              <p className="text-navy-300 mt-5 text-base leading-relaxed sm:text-lg">{reach.body}</p>

              <ul className="mt-8 space-y-3">
                <li className="text-navy-200 flex items-center gap-3 text-sm">
                  <span
                    className="bg-alert-500 size-2.5 shrink-0 rounded-full"
                    aria-hidden="true"
                  />
                  {reach.hub}
                </li>
                <li className="text-navy-200 flex items-center gap-3 text-sm">
                  <span
                    className="bg-signal-300 size-2.5 shrink-0 rounded-full"
                    aria-hidden="true"
                  />
                  {reach.onRequest}
                </li>
              </ul>

              <p className="text-navy-500 mt-6 font-mono text-xs tracking-wide">{reach.note}</p>
            </div>
          </Container>
        </section>

        <Section tone="raised">
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

      <Section>
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
      </div>
    </div>
  )
}
