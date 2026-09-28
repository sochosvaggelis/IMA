import { useEffect, useState } from 'react'
import { BACKEND, fetchPublished } from './backend'
import type { Table, Tables } from './types'

/**
 * How long fetched rows are trusted before the next page visit asks again.
 * Short, because the one person who notices staleness is the owner checking
 * an edit they have just made.
 */
const FRESH_MS = 60_000

const cache = new Map<Table, { at: number; rows: Promise<unknown[]> }>()

function load<T extends Table>(table: T): Promise<Tables[T][]> {
  const hit = cache.get(table)
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.rows as Promise<Tables[T][]>

  const rows = fetchPublished(table)
  cache.set(table, { at: Date.now(), rows })
  // A failure must not be cached, or one dropped packet would pin the
  // snapshot for the rest of the minute.
  rows.catch(() => cache.delete(table))
  return rows
}

/**
 * The published rows of `table`, for rendering.
 *
 * Returns `snapshot` — the rows as they were when the site was built (see
 * scripts/snapshot-content.mjs) — straight away, then swaps in the live rows
 * once they arrive. So the page never waits on the network to render, an edit
 * made in the admin panel shows up without a redeploy, and if the backend is
 * unreachable the visitor gets the last published content rather than an
 * empty page.
 */
export function usePublished<T extends Table>(table: T, snapshot: Tables[T][]): Tables[T][] {
  // Without a backend there is also nowhere for a photo to load from, so a
  // snapshot taken elsewhere must not render broken images here.
  const [rows, setRows] = useState(() =>
    BACKEND ? snapshot : snapshot.map((row) => ('photos' in row ? { ...row, photos: [] } : row)),
  )

  useEffect(() => {
    if (!BACKEND) return
    let current = true
    load(table).then(
      (live) => current && setRows(live),
      // Keep what is on screen. Nothing useful to tell a visitor here.
      () => {},
    )
    return () => {
      current = false
    }
  }, [table])

  return rows
}
