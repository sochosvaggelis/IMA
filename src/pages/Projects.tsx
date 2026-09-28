import { useState } from 'react'
import { useI18n } from '@/i18n/useI18n'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { ButtonLink } from '@/components/ui/Button'
import { PhotoViewer } from '@/components/ui/PhotoViewer'
import { ROUTES } from '@/routes'
import { photoUrl } from '@/content/backend'
import { pick } from '@/content/localise'
import { usePublished } from '@/content/usePublished'
import type { Project } from '@/content/types'
import snapshot from '@/content/snapshot/projects.json'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-navy-500 font-mono text-xs tracking-wide uppercase">{label}</dt>
      <dd className="text-navy-300 mt-1.5 text-sm leading-relaxed">{value}</dd>
    </div>
  )
}

export default function Projects() {
  const { t, lang } = useI18n()
  const { labels } = t.projects
  const projects = usePublished('projects', snapshot as Project[])
  const [viewing, setViewing] = useState<{ project: Project; index: number } | null>(null)

  return (
    <>
      <PageHeader eyebrow={t.projects.eyebrow} title={t.projects.title} intro={t.projects.intro} />

      <Section>
        {projects.length === 0 && <p className="text-navy-400">{t.projects.empty}</p>}

        <div className="space-y-4 lg:space-y-6">
          {projects.map((project) => {
            const title = pick(project, 'title', lang)
            return (
              <article
                key={project.id}
                className="border-navy-800 bg-navy-900/40 rounded-lg border p-6 sm:p-8 lg:p-10"
              >
                <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)] lg:gap-12">
                  <div>
                    <span className="border-signal-500/30 text-signal-400 inline-block rounded border px-2 py-0.5 font-mono text-xs">
                      {t.projects.scopes[project.scope]}
                    </span>
                    <h2 className="text-h3 mt-4 font-semibold text-balance text-white">{title}</h2>
                    <dl className="mt-6 space-y-4">
                      <Field label={labels.vessel} value={pick(project, 'vessel', lang)} />
                      <Field label={labels.location} value={pick(project, 'location', lang)} />
                    </dl>
                  </div>

                  <dl className="space-y-6">
                    <Field label={labels.problem} value={pick(project, 'problem', lang)} />
                    <Field label={labels.solution} value={pick(project, 'solution', lang)} />
                    <div className="border-navy-800 border-t pt-4">
                      <dt className="text-navy-500 font-mono text-xs tracking-wide uppercase">
                        {labels.downtime}
                      </dt>
                      <dd className="text-signal-400 mt-1.5 font-mono text-base font-semibold">
                        {pick(project, 'downtime', lang)}
                      </dd>
                    </div>
                  </dl>
                </div>

                {project.photos.length > 0 && (
                  <ul
                    aria-label={`${t.projects.photos}: ${title}`}
                    className="border-navy-800 mt-8 grid grid-cols-3 gap-2 border-t pt-6 sm:grid-cols-4 lg:mt-10 lg:grid-cols-6 lg:gap-3"
                  >
                    {project.photos.map((photo, index) => (
                      <li key={photo.full}>
                        <button
                          type="button"
                          onClick={() => setViewing({ project, index })}
                          className="group border-navy-800 bg-navy-900 block aspect-[4/3] w-full overflow-hidden rounded-md border"
                          aria-label={`${t.gallery.open} ${index + 1} — ${title}`}
                        >
                          <img
                            src={photoUrl(photo.thumb)}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            )
          })}
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

      <PhotoViewer
        photos={viewing?.project.photos ?? []}
        index={viewing?.index ?? null}
        onIndexChange={(index) => setViewing((v) => v && { ...v, index })}
        onClose={() => setViewing(null)}
        alt={viewing ? pick(viewing.project, 'title', lang) : ''}
        caption={
          viewing && (
            <>
              <p className="font-semibold text-white">{pick(viewing.project, 'title', lang)}</p>
              <p className="text-navy-400 mt-1 font-mono text-xs">
                {pick(viewing.project, 'vessel', lang)} · {pick(viewing.project, 'location', lang)}
              </p>
            </>
          )
        }
      />
    </>
  )
}
