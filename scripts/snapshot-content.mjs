/**
 * Copies the published content out of the database into
 * src/content/snapshot/<table>.json, which the build bakes into the site.
 *
 * The pages render this snapshot instantly and then replace it with live rows
 * (see src/content/usePublished.ts). It exists so that the site never shows
 * an empty page while the database is slow, down, or — on Supabase's free
 * tier — paused after a quiet week.
 *
 *   npm run snapshot
 *
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY from the
 * environment (or .env). The deploy workflow runs it before every build, and
 * on a daily schedule, which also keeps a free-tier project from pausing.
 *
 * With no backend configured it leaves the committed snapshot alone and exits
 * cleanly — a fork, or the site before Supabase is set up, still builds. But
 * once a backend IS configured, failing to reach it fails the script: the
 * deploy then stops, and the last good deployment stays up, rather than
 * shipping a build whose snapshot is older than the one already live.
 */
import { writeFile } from 'node:fs/promises'

const TABLES = ['projects', 'spare_parts', 'capability_groups', 'certifications', 'ports']
const OUT = new URL('../src/content/snapshot/', import.meta.url)

const url = process.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '')
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

if (!url || !key) {
  console.log('snapshot: no Supabase configured — keeping the committed snapshot.')
  process.exit(0)
}

for (const table of TABLES) {
  // Same query as fetchPublished() in src/content/backend.ts.
  const query = new URLSearchParams({
    select: '*',
    published: 'is.true',
    order: 'position.asc,created_at.desc',
  })
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: { apikey: key, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    console.error(`snapshot: ${table} → HTTP ${response.status}: ${await response.text()}`)
    process.exit(1)
  }
  const rows = await response.json()
  await writeFile(new URL(`${table}.json`, OUT), `${JSON.stringify(rows, null, 2)}\n`)
  console.log(`snapshot: ${table} → ${rows.length} rows`)
}
