import { useI18n } from '@/i18n/useI18n'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { ButtonLink } from '@/components/ui/Button'
import { ROUTES } from '@/routes'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-navy-500 font-mono text-xs tracking-wide uppercase">{label}</dt>
      <dd className="text-navy-300 mt-1.5 text-sm leading-relaxed">{value}</dd>
    </div>
  )
}

export default function Projects() {
  const { t } = useI18n()
  const { labels } = t.projects

  return (
    <>
      <PageHeader eyebrow={t.projects.eyebrow} title={t.projects.title} intro={t.projects.intro} />

      <Section>
        <div className="space-y-4 lg:space-y-6">
          {t.projects.items.map((project) => (
            <article
              key={project.id}
              className="border-navy-800 bg-navy-900/40 rounded-lg border p-6 sm:p-8 lg:p-10"
            >
              <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)] lg:gap-12">
                <div>
                  <span className="border-signal-500/30 text-signal-400 inline-block rounded border px-2 py-0.5 font-mono text-xs">
                    {project.scope}
                  </span>
                  <h2 className="text-h3 mt-4 font-semibold text-balance text-white">
                    {project.title}
                  </h2>
                  <dl className="mt-6 space-y-4">
                    <Field label={labels.vessel} value={project.vessel} />
                    <Field label={labels.location} value={project.location} />
                  </dl>
                </div>

                <dl className="space-y-6">
                  <Field label={labels.problem} value={project.problem} />
                  <Field label={labels.solution} value={project.solution} />
                  <div className="border-navy-800 border-t pt-4">
                    <dt className="text-navy-500 font-mono text-xs tracking-wide uppercase">
                      {labels.downtime}
                    </dt>
                    <dd className="text-signal-400 mt-1.5 font-mono text-base font-semibold">
                      {project.downtime}
                    </dd>
                  </div>
                </dl>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section tone="raised" className="text-center">
        <h2 className="text-h2 text-balance font-semibold text-white">{t.home.ctaBand.title}</h2>
        <div className="mt-8">
          <ButtonLink to={ROUTES.contact} variant="alert" size="lg">
            {t.home.ctaBand.cta}
          </ButtonLink>
        </div>
      </Section>
    </>
  )
}
