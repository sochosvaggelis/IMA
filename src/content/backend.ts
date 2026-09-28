/**
 * Where the editable content lives: a Supabase project, reached over its REST
 * API with plain fetch.
 *
 * Deliberately not supabase-js. Public pages only ever read published rows,
 * which is one GET — shipping the client library to every visitor for that
 * would put ~50 kB in front of someone on ship wifi opening /projects. The
 * admin panel, which does need the library, loads it in its own chunk.
 *
 * Both values are PUBLIC by design (see .env.example): the key only unlocks
 * what the database's row-level security allows an anonymous visitor, which
 * is reading published rows. Unset, the site runs on its build-time snapshot
 * alone — see usePublished.
 */
import type { Table, Tables } from './types'

const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '')
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const BACKEND = url && key ? { url, key } : null

/** The storage bucket holding every uploaded photo. */
export const MEDIA_BUCKET = 'media'

/** Long enough for a phone on ship wifi; after this the snapshot stands. */
const TIMEOUT_MS = 10_000

/** Public URL of a file in the media bucket. */
export function photoUrl(path: string): string {
  return `${BACKEND?.url ?? ''}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`
}

/** Published rows of `table`, in display order. Throws if nothing came back. */
export async function fetchPublished<T extends Table>(table: T): Promise<Tables[T][]> {
  if (!BACKEND) throw new Error('No content backend is configured.')

  const query = new URLSearchParams({
    select: '*',
    // RLS already hides drafts from this key; asking explicitly means a
    // policy mistake shows drafts to nobody rather than to everybody.
    published: 'is.true',
    order: 'position.asc,created_at.desc',
  })

  const response = await fetch(`${BACKEND.url}/rest/v1/${table}?${query}`, {
    headers: { apikey: BACKEND.key, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Content request for ${table} failed: ${response.status}`)
  return response.json()
}
