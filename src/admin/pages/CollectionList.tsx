import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ADMIN_ROOT } from '@/routes'
import { photoUrl } from '@/content/backend'
import { cn } from '@/lib/cn'
import { db } from '../client'
import { hasPhotos, titleOf, type Collection, type Row } from '../collections'
import { button, card, iconButton, input } from '../styles'

function Arrow({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={up ? 'M5 12l5-5 5 5' : 'M5 8l5 5 5-5'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Case- and accent-insensitive, so "πλακετα" finds "Πλακέτα". */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/**
 * Every row of a collection, drafts included, in the order the site shows
 * them. Publishing and reordering happen right here; editing and deleting
 * open the row.
 */
export default function CollectionList({ collection }: { collection: Collection }) {
  const base = `${ADMIN_ROOT}/${collection.slug}`
  const withPhotos = hasPhotos(collection)
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice

  const [rows, setRows] = useState<Row[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoadError(false)
    const { data, error } = await db()
      .from(collection.table)
      .select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
    if (error) setLoadError(true)
    else setRows(data as Row[])
  }, [collection.table])

  useEffect(() => {
    void load()
  }, [load])

  /** Runs a write; on failure says so and reloads, so the screen never shows
      an order or a state the database does not actually hold. */
  async function write(run: () => Promise<{ error: { message: string } | null; data: unknown[] | null }[]>) {
    setBusy(true)
    setActionError(null)
    const results = await run()
    // A refused update matches no rows rather than erroring — count them.
    const failed = results.find((r) => r.error || !r.data?.length)
    if (failed) {
      setActionError(`Could not save that change${failed.error ? `: ${failed.error.message}` : '.'}`)
      await load()
    }
    setBusy(false)
  }

  function togglePublished(row: Row) {
    const published = !row.published
    setRows((list) => list!.map((r) => (r.id === row.id ? { ...r, published } : r)))
    void write(() => Promise.all([db().from(collection.table).update({ published }).eq('id', row.id!).select('id')]))
  }

  function move(index: number, delta: -1 | 1) {
    const list = rows!
    const a = list[index]
    const b = list[index + delta]
    if (!a || !b) return

    const next = [...list]
    next[index] = b
    next[index + delta] = a

    // Swap the two positions — or, if they are equal (rows added before
    // positions were kept distinct), renumber the whole list so the order
    // actually sticks.
    let changes: { id: string; position: number }[]
    if (a.position !== b.position) {
      changes = [
        { id: a.id!, position: b.position! },
        { id: b.id!, position: a.position! },
      ]
    } else {
      changes = next.map((r, i) => ({ id: r.id!, position: i + 1 })).filter((c, i) => next[i].position !== c.position)
    }
    const byId = new Map(changes.map((c) => [c.id, c.position]))
    setRows(next.map((r) => (byId.has(r.id!) ? { ...r, position: byId.get(r.id!) } : r)))

    void write(() =>
      Promise.all(
        changes.map((c) => db().from(collection.table).update({ position: c.position }).eq('id', c.id).select('id')),
      ),
    )
  }

  const needle = fold(query.trim())
  const shown =
    rows && needle
      ? rows.filter((r) =>
          fold([r.title_el, r.title_en, r.name, collection.describe(r)].map((v) => String(v ?? '')).join(' ')).includes(
            needle,
          ),
        )
      : rows
  const searching = needle.length > 0

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">
          {collection.title}
          {rows && <span className="text-navy-500 ml-2 text-base font-normal">{rows.length}</span>}
        </h1>
        <Link to={`${base}/new`} className={button('primary')}>
          + Add {collection.noun}
        </Link>
      </div>

      <p className="text-navy-400 mt-2 text-sm">
        Shown on the site in this order.
        {collection.note && ` ${collection.note}`}{' '}
        <Link to={collection.publicPath} target="_blank" rel="noreferrer" className="text-signal-400 hover:underline">
          View on site ↗
        </Link>
      </p>

      {notice && (
        <p role="status" className="border-signal-500/40 bg-signal-500/10 text-signal-300 mt-5 rounded-md border px-4 py-3 text-sm">
          {notice}
        </p>
      )}
      {actionError && (
        <p role="alert" className="border-alert-600/50 text-alert-500 mt-5 rounded-md border px-4 py-3 text-sm">
          {actionError}
        </p>
      )}

      {rows && rows.length > 5 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${collection.title.toLowerCase()}…`}
          aria-label={`Search ${collection.title.toLowerCase()}`}
          className={cn(input, 'mt-6')}
        />
      )}

      <div className="mt-6">
        {loadError ? (
          <div className={cn(card, 'p-6')}>
            <p className="text-navy-300">Could not load the list. Check your connection.</p>
            <button type="button" className={button('secondary', 'mt-4')} onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : !shown ? (
          <p className="text-navy-500 text-sm">Loading…</p>
        ) : shown.length === 0 ? (
          <div className={cn(card, 'p-8 text-center')}>
            <p className="text-navy-300">
              {searching ? 'Nothing matches that search.' : `No ${collection.title.toLowerCase()} yet.`}
            </p>
          </div>
        ) : (
          <ul className={cn(card, 'divide-navy-800 divide-y')} aria-busy={busy}>
            {shown.map((row, index) => {
              const cover = row.photos?.[0]
              const edit = `${base}/${row.id}`
              const describe = collection.describe(row)
              return (
                <li key={row.id} className="flex items-center gap-3 p-3 sm:gap-4 sm:px-4">
                  {withPhotos && (
                    <Link to={edit} className="bg-navy-900 border-navy-800 block size-16 shrink-0 overflow-hidden rounded border" tabIndex={-1} aria-hidden="true">
                      {cover ? (
                        <img src={photoUrl(cover.thumb)} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <span className="blueprint-grid block size-full opacity-60" />
                      )}
                    </Link>
                  )}

                  <div className="min-w-0 flex-1">
                    <Link to={edit} className="hover:text-signal-400 block truncate font-medium text-white">
                      {titleOf(row)}
                    </Link>
                    {describe && <p className="text-navy-500 truncate text-xs">{describe}</p>}
                    <button
                      type="button"
                      onClick={() => togglePublished(row)}
                      disabled={busy}
                      title={row.published ? 'Click to hide from the site' : 'Click to publish'}
                      className={cn(
                        'mt-1.5 inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors',
                        row.published
                          ? 'border-signal-500/50 text-signal-300 hover:border-signal-400'
                          : 'border-navy-600 text-navy-400 hover:text-white',
                      )}
                    >
                      <span
                        className={cn('size-1.5 rounded-full', row.published ? 'bg-signal-400' : 'bg-navy-500')}
                        aria-hidden="true"
                      />
                      {row.published ? 'Published' : 'Draft'}
                    </button>
                  </div>

                  {/* Reordering while filtered would swap with rows that are
                      not on screen, so it is simply not offered then. */}
                  {!searching && (
                    <div className="flex shrink-0 flex-col sm:flex-row">
                      <button
                        type="button"
                        className={iconButton}
                        disabled={busy || index === 0}
                        onClick={() => move(index, -1)}
                        aria-label={`Move “${titleOf(row)}” up`}
                      >
                        <Arrow up />
                      </button>
                      <button
                        type="button"
                        className={iconButton}
                        disabled={busy || index === shown.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label={`Move “${titleOf(row)}” down`}
                      >
                        <Arrow up={false} />
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
