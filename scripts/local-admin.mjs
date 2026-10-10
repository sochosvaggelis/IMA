/**
 * Finishes setting up the LOCAL Supabase stack for the dev server:
 *
 *   1. creates an admin login (or resets its password if it exists),
 *   2. adds it to the admins table, so the panel lets it in,
 *   3. writes .env.development.local, pointing `npm run dev` at the local
 *      stack instead of the live database.
 *
 *   npm run db:start                              first, to start the stack
 *   npm run db:admin                              admin@ima.local / local-admin
 *   npm run db:admin -- you@example.com secret    your own choice
 *
 * Talks only to the local stack — the address and keys come from
 * `supabase status`, never from .env — so it cannot touch the live project.
 * The service-role key it uses is the local stack's, printed by the CLI for
 * exactly this, and is not written anywhere.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const EMAIL = process.argv[2] ?? 'admin@ima.local'
const PASSWORD = process.argv[3] ?? 'local-admin'
const ENV_FILE = new URL('../.env.development.local', import.meta.url)

function fail(message) {
  console.error(`db:admin: ${message}`)
  process.exit(1)
}

// The CLI version is pinned once, in package.json's db:* scripts.
let status
try {
  const out = execSync('npm run --silent db:status -- -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  status = JSON.parse(out.slice(out.indexOf('{')))
} catch {
  fail('the local stack is not running. Start it with `npm run db:start` (needs Docker Desktop).')
}

const api = status.API_URL
// The legacy JWT keys work with both headers; prefer them where offered.
const service = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY
const publishable = status.PUBLISHABLE_KEY ?? status.ANON_KEY
if (!api || !service || !publishable) fail(`unexpected \`supabase status\` output: ${Object.keys(status).join(', ')}`)
if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(api)) fail(`refusing: ${api} is not a local address.`)

const headers = { apikey: service, 'content-type': 'application/json' }
if (service.startsWith('ey')) headers.authorization = `Bearer ${service}`

// 1. The login.
let userId
const created = await fetch(`${api}/auth/v1/admin/users`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
})
if (created.ok) {
  userId = (await created.json()).id
  console.log(`created ${EMAIL}`)
} else {
  const list = await fetch(`${api}/auth/v1/admin/users?per_page=1000`, { headers })
  const existing = list.ok ? ((await list.json()).users ?? []).find((u) => u.email === EMAIL) : null
  if (!existing) fail(`could not create ${EMAIL}: ${created.status} ${await created.text()}`)
  userId = existing.id
  const updated = await fetch(`${api}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ password: PASSWORD }),
  })
  if (!updated.ok) fail(`could not reset the password: ${updated.status} ${await updated.text()}`)
  console.log(`${EMAIL} already existed — password reset`)
}

// 2. Admin rights. Upsert, so running this twice is harmless.
const admin = await fetch(`${api}/rest/v1/admins?on_conflict=user_id`, {
  method: 'POST',
  headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=minimal' },
  body: JSON.stringify({ user_id: userId }),
})
if (!admin.ok) fail(`could not make ${EMAIL} an admin: ${admin.status} ${await admin.text()}`)

// 3. Point the dev server at the local stack — without clobbering a file
//    that points somewhere else on purpose.
const lines = [
  '# Written by `npm run db:admin`: `npm run dev` uses the LOCAL Supabase stack.',
  '# Delete this file to point the dev server back at the database in .env.',
  `VITE_SUPABASE_URL=${api}`,
  `VITE_SUPABASE_PUBLISHABLE_KEY=${publishable}`,
  '',
].join('\n')
if (!existsSync(ENV_FILE) || readFileSync(ENV_FILE, 'utf8').includes(api)) {
  writeFileSync(ENV_FILE, lines)
  console.log('wrote .env.development.local')
} else {
  console.log('.env.development.local exists and points elsewhere — left alone. To use the local stack, set:')
  console.log(lines)
}

console.log(`
Local stack ready. Restart \`npm run dev\`, then:
  admin panel     http://localhost:5173/admin   (${EMAIL} / ${PASSWORD})
  database UI     ${status.STUDIO_URL ?? 'http://127.0.0.1:54323'}
  caught emails   ${status.MAILPIT_URL ?? status.INBUCKET_URL ?? 'http://127.0.0.1:54324'}   (password resets land here)`)
