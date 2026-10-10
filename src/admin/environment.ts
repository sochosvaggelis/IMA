import { BACKEND } from '@/content/backend'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * A warning label for when the panel is NOT editing the live site: the two
 * look identical otherwise, and a change meant for a test database made on
 * the real one goes straight onto imagreece.gr.
 *
 *   - Local stack (npm run db:start): detected from the address, no setup.
 *   - A remote test project: set VITE_SUPABASE_LABEL (e.g. "Test DB") in
 *     .env.development.local alongside its URL and key.
 *
 * null — no label — means the live database. The deployed build never sets
 * one, and never points at a local address.
 */
export const DATABASE_LABEL: string | null = (() => {
  const explicit = import.meta.env.VITE_SUPABASE_LABEL?.trim()
  if (explicit) return explicit
  if (!BACKEND) return null
  try {
    return LOCAL_HOSTS.has(new URL(BACKEND.url).hostname) ? 'Local DB' : null
  } catch {
    return null
  }
})()
