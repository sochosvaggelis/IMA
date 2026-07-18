import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n/useI18n'
import { ROUTES } from '@/routes'
import { telHref } from '@/lib/contact'
import { VesselScene } from '@/components/hero/VesselScene'
import { Container } from '@/components/ui/Container'
import { Section, SectionHeading } from '@/components/ui/Section'
import { ButtonLink } from '@/components/ui/Button'

function ArrowRight() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Hero() {
  const { t } = useI18n()

  return (
    <>
      <Container size="wide" className="relative pt-14 pb-14 lg:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow mb-5">{t.hero.eyebrow}</p>
          <h1 className="text-display font-semibold text-balance text-white">
            {t.hero.title}{' '}
            <span className="text-signal-400 block">{t.hero.titleAccent}</span>
          </h1>
          <p className="text-navy-200 mx-auto mt-6 max-w-xl text-base leading-relaxed sm:mt-8 sm:text-lg">
            {t.hero.subtitle}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
            <ButtonLink to={ROUTES.contact} variant="alert" size="lg">
              {t.hero.ctaPrimary}
            </ButtonLink>
            <ButtonLink to={ROUTES.services} variant="secondary" size="lg">
              {t.hero.ctaSecondary}
              <ArrowRight />
            </ButtonLink>
          </div>
        </div>

        {/* Stats: a scannable credibility line before scroll */}
        <dl className="border-navy-800/70 mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-navy-800/70 lg:mt-16 lg:grid-cols-4">
          {t.hero.stats.map((stat) => (
            // col-reverse keeps the value on top while dt still precedes dd in the DOM
            <div
              key={stat.label}
              className="bg-navy-950/80 flex flex-col-reverse px-4 py-4 sm:px-5 sm:py-5"
            >
              <dt className="text-navy-400 mt-1 text-xs sm:text-sm">{stat.label}</dt>
              <dd className="text-signal-400 font-mono text-xl font-semibold sm:text-2xl">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </>
  )
}

function Problem() {
  const { t } = useI18n()
  const { problem } = t.home

  return (
    <Section tone="raised">
      <div className="max-w-3xl">
        <p className="eyebrow mb-3">{problem.eyebrow}</p>
        <h2 className="text-h2 text-balance font-semibold text-white">{problem.title}</h2>
        <p className="text-navy-300 mt-6 text-base leading-relaxed sm:text-lg">{problem.body}</p>
        <p className="text-signal-400 border-signal-500/40 mt-8 border-l-2 pl-5 text-h3 font-semibold">
          {problem.contrast}
        </p>
      </div>
    </Section>
  )
}

function ServicesTeaser() {
  const { t } = useI18n()
  const teaser = t.home.servicesTeaser

  return (
    <Section>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading eyebrow={teaser.eyebrow} title={teaser.title} intro={teaser.body} />
        <ButtonLink to={ROUTES.services} variant="secondary" className="shrink-0">
          {teaser.cta}
          <ArrowRight />
        </ButtonLink>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3 lg:gap-6">
        {t.services.levels.map((level) => (
          <Link
            key={level.id}
            to={`${ROUTES.services}#${level.id}`}
            className="border-navy-800 bg-navy-900/40 hover:border-signal-500/50 hover:bg-navy-900/70 group flex flex-col rounded-lg border p-6 transition-colors lg:p-8"
          >
            <span className="text-signal-500/70 font-mono text-sm">{level.index}</span>
            <h3 className="text-h3 mt-4 font-semibold text-white">{level.name}</h3>
            <p className="text-navy-400 mt-3 flex-1 text-sm leading-relaxed">{level.summary}</p>
            <span className="text-signal-400 mt-6 inline-flex items-center gap-2 text-sm font-medium transition-transform group-hover:translate-x-1">
              <ArrowRight />
            </span>
          </Link>
        ))}
      </div>
    </Section>
  )
}

function CapabilitiesTeaser() {
  const { t } = useI18n()
  const teaser = t.home.capabilitiesTeaser
  const brands = t.capabilities.groups.flatMap((group) => group.brands)

  return (
    <Section tone="raised">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading eyebrow={teaser.eyebrow} title={teaser.title} intro={teaser.body} />
        <ButtonLink to={ROUTES.capabilities} variant="secondary" className="shrink-0">
          {teaser.cta}
          <ArrowRight />
        </ButtonLink>
      </div>

      <ul className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-navy-800 bg-navy-800 sm:grid-cols-3 lg:grid-cols-6">
        {brands.map((brand) => (
          <li
            key={brand}
            className="bg-navy-950 text-navy-300 flex min-h-16 items-center justify-center px-3 py-4 text-center font-mono text-xs tracking-wide"
          >
            {brand}
          </li>
        ))}
      </ul>
    </Section>
  )
}

function ProjectsTeaser() {
  const { t } = useI18n()
  const teaser = t.home.projectsTeaser

  return (
    <Section>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading eyebrow={teaser.eyebrow} title={teaser.title} intro={teaser.body} />
        <ButtonLink to={ROUTES.projects} variant="secondary" className="shrink-0">
          {teaser.cta}
          <ArrowRight />
        </ButtonLink>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:gap-6">
        {t.projects.items.slice(0, 2).map((project) => (
          <article
            key={project.id}
            className="border-navy-800 bg-navy-900/40 flex flex-col rounded-lg border p-6 lg:p-8"
          >
            <div className="text-navy-500 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
              <span>{project.vessel}</span>
              <span aria-hidden="true">·</span>
              <span>{project.location}</span>
            </div>
            <h3 className="text-h3 mt-4 font-semibold text-balance text-white">{project.title}</h3>
            <p className="text-navy-400 mt-4 flex-1 text-sm leading-relaxed">{project.problem}</p>
            <div className="border-navy-800 mt-6 border-t pt-4">
              <span className="text-navy-500 text-xs">{t.projects.labels.downtime}</span>
              <p className="text-signal-400 font-mono text-sm font-medium">{project.downtime}</p>
            </div>
          </article>
        ))}
      </div>
    </Section>
  )
}

function CtaBand() {
  const { t } = useI18n()
  const { ctaBand } = t.home

  return (
    <section className="border-navy-800 relative overflow-hidden border-t">
      <div className="blueprint-grid absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="from-navy-950 via-navy-900/80 to-navy-950 absolute inset-0 bg-linear-to-r" aria-hidden="true" />
      <Container className="relative py-16 text-center sm:py-20 lg:py-24">
        <h2 className="text-h2 text-balance font-semibold text-white">{ctaBand.title}</h2>
        <p className="text-navy-300 mx-auto mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
          {ctaBand.body}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <ButtonLink to={ROUTES.contact} variant="alert" size="lg" className="w-full sm:w-auto">
            {ctaBand.cta}
          </ButtonLink>
          <p className="text-navy-400 text-sm">
            {ctaBand.or}{' '}
            <a
              href={telHref(t.emergency.phone)}
              className="text-alert-500 hover:text-alert-600 font-mono transition-colors"
            >
              {t.emergency.phone}
            </a>
          </p>
        </div>
      </Container>
    </section>
  )
}

/**
 * TEMPORARY: the page copy is parked while the scroll sweep is being dialled
 * in — the sections have opaque backgrounds and would paint straight over the
 * vessel. Nothing is deleted; flip this to true to bring the page back.
 */
const SHOW_PAGE_CONTENT: boolean = false

export default function Home() {
  const { t } = useI18n()

  return (
    <>
      {/* Fixed layer + its own scroll runway; renders behind everything. */}
      <VesselScene label={t.hero.sceneLabel} />

      {SHOW_PAGE_CONTENT && (
        <>
          <Hero />
          <Problem />
          <ServicesTeaser />
          <CapabilitiesTeaser />
          <ProjectsTeaser />
          <CtaBand />
        </>
      )}
    </>
  )
}
