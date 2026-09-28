import { useMemo, useState } from 'react'
import { useI18n } from '@/i18n/useI18n'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { ButtonLink } from '@/components/ui/Button'
import { PhotoViewer } from '@/components/ui/PhotoViewer'
import { ROUTES, enquireAbout } from '@/routes'
import { photoUrl } from '@/content/backend'
import { pick } from '@/content/localise'
import { usePublished } from '@/content/usePublished'
import type { SparePart } from '@/content/types'
import { cn } from '@/lib/cn'
import snapshot from '@/content/snapshot/spare_parts.json'

/** Maker and part number on one line, whichever of the two were filled in. */
function reference(part: SparePart): string {
  return [part.manufacturer, part.model].filter((s) => s.trim()).join(' · ')
}

function PartCard({ part, onOpen }: { part: SparePart; onOpen: () => void }) {
  const { t, lang } = useI18n()
  const cover = part.photos[0]
  const title = pick(part, 'title', lang)
  const ref = reference(part)

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!cover}
      className="group block w-full text-left disabled:cursor-default"
      aria-label={`${t.gallery.open} — ${title}`}
    >
      <div className="border-navy-800 bg-navy-900 relative aspect-[4/3] overflow-hidden rounded-md border">
        {cover ? (
          <img
            src={photoUrl(cover.thumb)}
            alt=""
            loading="lazy"
            width={cover.w}
            height={cover.h}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="blueprint-grid size-full opacity-60" aria-hidden="true" />
        )}
        {part.photos.length > 1 && (
          <span className="bg-navy-950/80 text-navy-100 absolute top-2 right-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs">
            <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <rect x="2.5" y="5" width="15" height="11" rx="1.5" />
              <path d="M7 5l1.2-2h3.6L13 5" strokeLinejoin="round" />
              <circle cx="10" cy="10.5" r="2.8" />
            </svg>
            {part.photos.length}
          </span>
        )}
      </div>
      {ref && (
        <p className="text-navy-500 mt-3 truncate font-mono text-xs tracking-wide uppercase">{ref}</p>
      )}
      <p
        className={cn(
          'text-navy-100 text-sm leading-snug font-medium group-hover:text-white',
          ref ? 'mt-1' : 'mt-3',
        )}
      >
        {title}
      </p>
    </button>
  )
}

export default function SpareParts() {
  const { t, lang } = useI18n()
  const copy = t.spareParts
  const parts = usePublished('spare_parts', snapshot as SparePart[])
  const [maker, setMaker] = useState<string | null>(null)
  const [viewing, setViewing] = useState<{ part: SparePart; index: number } | null>(null)

  // Offered only once there is more than one to choose between.
  const makers = useMemo(
    () =>
      [...new Set(parts.map((p) => p.manufacturer.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [parts],
  )
  // A filter whose maker vanished when the live rows replaced the snapshot
  // would leave an empty grid with no chip lit to explain it.
  const active = maker && makers.includes(maker) ? maker : null
  const shown = active ? parts.filter((p) => p.manufacturer.trim() === active) : parts

  const chip = (on: boolean) =>
    cn(
      'min-h-9 rounded-full border px-3.5 text-sm transition-colors',
      on
        ? 'border-signal-500 bg-signal-500/10 text-signal-300'
        : 'border-navy-700 text-navy-300 hover:border-navy-500 hover:text-white',
    )

  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} intro={copy.intro} />

      <Section>
        {makers.length > 1 && (
          <div role="group" aria-label={copy.filterLabel} className="mb-8 flex flex-wrap gap-2 lg:mb-10">
            <button type="button" className={chip(active === null)} aria-pressed={active === null} onClick={() => setMaker(null)}>
              {copy.all}
            </button>
            {makers.map((name) => (
              <button
                key={name}
                type="button"
                className={chip(active === name)}
                aria-pressed={active === name}
                onClick={() => setMaker(name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {shown.length === 0 ? (
          <p className="text-navy-400">{copy.empty}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10">
            {shown.map((part) => (
              <li key={part.id}>
                <PartCard part={part} onOpen={() => setViewing({ part, index: 0 })} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section tone="raised" className="text-center">
        <h2 className="text-h2 text-balance font-semibold text-white">{copy.cta.title}</h2>
        <p className="text-navy-300 mx-auto mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
          {copy.cta.body}
        </p>
        <div className="mt-8">
          <ButtonLink to={`${ROUTES.contact}?urgency=planned`} size="lg">
            {copy.cta.button}
          </ButtonLink>
        </div>
      </Section>

      <PhotoViewer
        photos={viewing?.part.photos ?? []}
        index={viewing?.index ?? null}
        onIndexChange={(index) => setViewing((v) => v && { ...v, index })}
        onClose={() => setViewing(null)}
        alt={viewing ? pick(viewing.part, 'title', lang) : ''}
        caption={viewing && <PartCaption part={viewing.part} />}
      />
    </>
  )
}

function PartCaption({ part }: { part: SparePart }) {
  const { t, lang } = useI18n()
  const title = pick(part, 'title', lang)
  const ref = reference(part)
  const description = pick(part, 'description', lang)

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="min-w-0">
        {ref && <p className="text-navy-400 font-mono text-xs tracking-wide uppercase">{ref}</p>}
        <p className="mt-1 font-semibold text-white">{title}</p>
        {description && (
          <p className="text-navy-300 mt-2 text-sm leading-relaxed whitespace-pre-line">{description}</p>
        )}
      </div>
      <ButtonLink
        to={enquireAbout([ref, title].filter(Boolean).join(' — '))}
        variant="secondary"
        className="shrink-0 self-start"
      >
        {t.spareParts.ask}
      </ButtonLink>
    </div>
  )
}
