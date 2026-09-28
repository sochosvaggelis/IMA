import type { Page, Request, Route } from '@playwright/test'

/**
 * A stand-in for the Supabase project, served from inside the browser via
 * request interception — enough of Auth, PostgREST and Storage for the admin
 * panel and the public pages to run for real against it.
 *
 * It mimics the row-level security in supabase/migrations: anonymous and
 * non-admin requests see published rows only, writes from anyone but an admin
 * are refused (inserts with an error, updates and deletes by matching nothing
 * — exactly how Postgres reports them), so the panel's handling of both is
 * exercised too.
 *
 * The backend URL is the one playwright.config.ts builds the dev server with.
 */
export const BACKEND_URL = 'https://backend.e2e.test'

export const ADMIN = { id: '00000000-0000-4000-8000-00000000000a', email: 'owner@ima.test', password: 'correct horse' }
export const STRANGER = { id: '00000000-0000-4000-8000-00000000000b', email: 'someone@else.test', password: 'hunter22' }

type Row = Record<string, unknown> & { id: string }
type StoredFile = { body: Buffer; contentType: string }

const texts = (...columns: string[]) => Object.fromEntries(columns.map((c) => [c, '']))

/** The column defaults in supabase/migrations, applied to every insert as
    Postgres would — the site relies on text columns never being null. */
const DEFAULTS: Record<string, Record<string, unknown>> = {
  projects: {
    scope: 'systems',
    ...texts(
      ...['title', 'vessel', 'location', 'problem', 'solution', 'downtime'].flatMap((f) => [`${f}_el`, `${f}_en`]),
    ),
  },
  spare_parts: texts('title_el', 'title_en', 'manufacturer', 'model', 'description_el', 'description_en'),
  capability_groups: { ...texts('title_el', 'title_en'), brands: [] },
  certifications: texts('name', 'detail_el', 'detail_en'),
  ports: { tier: 'secondary', ...texts('title_el', 'title_en') },
}

/** Every column each table has. PostgREST refuses a write naming any other
    (PGRST204) — which is how a form sending, say, `photos` to a table
    without one would fail against the real thing. */
const COLUMNS: Record<string, Set<string>> = Object.fromEntries(
  Object.entries(DEFAULTS).map(([table, defaults]) => [
    table,
    new Set([
      'id',
      'position',
      'published',
      'created_at',
      'updated_at',
      ...Object.keys(defaults),
      ...(['projects', 'spare_parts'].includes(table) ? ['photos'] : []),
    ]),
  ]),
)

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

/** A JWT-shaped token: supabase-js may read its claims, nothing verifies it. */
function tokenFor(user: { id: string; email: string }): string {
  const now = Math.floor(Date.now() / 1000)
  return [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 }),
    'signature',
  ].join('.')
}

function userJson(user: { id: string; email: string }) {
  return {
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  }
}

/** Splits a multipart body and returns the file part — storage-js uploads a
    Blob as FormData with the file under an empty field name. */
function filePart(request: Request): StoredFile | null {
  const type = request.headers()['content-type'] ?? ''
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(type)
  const raw = request.postDataBuffer()
  if (!boundary || !raw) return null
  const marker = Buffer.from(`--${boundary[1] ?? boundary[2]}`)
  let at = raw.indexOf(marker)
  while (at !== -1) {
    const next = raw.indexOf(marker, at + marker.length)
    if (next === -1) break
    const part = raw.subarray(at + marker.length + 2, next - 2) // drop leading CRLF / trailing CRLF
    const split = part.indexOf('\r\n\r\n')
    const headers = part.subarray(0, split).toString()
    const fileType = /content-type:\s*([^\r\n]+)/i.exec(headers)
    if (/filename=/i.test(headers) && fileType) return { body: part.subarray(split + 4), contentType: fileType[1].trim() }
    at = next
  }
  return null
}

export class FakeSupabase {
  readonly tables: Record<string, Row[]> = Object.fromEntries(Object.keys(DEFAULTS).map((t) => [t, []]))
  readonly files = new Map<string, StoredFile>()
  readonly admins = new Set([ADMIN.id])
  /** When set, every REST call fails — the site must fall back to its snapshot. */
  down = false
  private nextId = 1

  seed(table: string, rows: Partial<Row>[]): Row[] {
    const made = rows.map((row, i) => ({
      id: `10000000-0000-4000-8000-${String(this.nextId++).padStart(12, '0')}`,
      position: i + 1,
      published: true,
      ...(COLUMNS[table].has('photos') ? { photos: [] } : {}),
      created_at: new Date(2026, 0, 1, 0, 0, i).toISOString(),
      ...DEFAULTS[table],
      ...row,
    })) as Row[]
    this.tables[table].push(...made)
    return made
  }

  async install(page: Page): Promise<void> {
    await page.route(`${BACKEND_URL}/**`, (route) => this.handle(route))
  }

  private userOf(request: Request): string | null {
    const token = /^Bearer (.+)$/.exec(request.headers()['authorization'] ?? '')?.[1]
    const payload = token?.split('.')[1]
    if (!payload) return null
    try {
      return (JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub?: string }).sub ?? null
    } catch {
      return null // the publishable key, not a user token
    }
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: cors() })
    }
    if (path.startsWith('/auth/v1/')) return this.auth(route, path.slice('/auth/v1/'.length))
    if (path.startsWith('/rest/v1/')) return this.rest(route, url)
    if (path.startsWith('/storage/v1/')) return this.storage(route, path.slice('/storage/v1/'.length))
    return route.fulfill({ status: 404, headers: cors(), json: { message: 'not found' } })
  }

  private auth(route: Route, endpoint: string) {
    const request = route.request()
    if (endpoint.startsWith('token')) {
      const { email, password } = request.postDataJSON() as { email: string; password: string }
      const user = [ADMIN, STRANGER].find((u) => u.email === email && u.password === password)
      if (!user) {
        return route.fulfill({
          status: 400,
          headers: cors(),
          json: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' },
        })
      }
      const now = Math.floor(Date.now() / 1000)
      return route.fulfill({
        headers: cors(),
        json: {
          access_token: tokenFor(user),
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: now + 3600,
          refresh_token: `refresh-${user.id}`,
          user: userJson(user),
        },
      })
    }
    if (endpoint.startsWith('logout')) return route.fulfill({ status: 204, headers: cors() })
    if (endpoint.startsWith('recover')) return route.fulfill({ headers: cors(), json: {} })
    if (endpoint.startsWith('user')) {
      const id = this.userOf(request)
      const user = [ADMIN, STRANGER].find((u) => u.id === id)
      if (!user) return route.fulfill({ status: 401, headers: cors(), json: { msg: 'not signed in' } })
      return route.fulfill({ headers: cors(), json: userJson(user) })
    }
    return route.fulfill({ status: 404, headers: cors(), json: { msg: `no fake for auth/${endpoint}` } })
  }

  private rest(route: Route, url: URL) {
    const request = route.request()
    if (this.down) return route.fulfill({ status: 503, headers: cors(), json: { message: 'down' } })

    const table = url.pathname.slice('/rest/v1/'.length)
    const userId = this.userOf(request)
    const admin = userId !== null && this.admins.has(userId)

    if (table === 'admins') {
      const rows = userId && this.admins.has(userId) ? [{ user_id: userId }] : []
      return route.fulfill({ headers: cors(), json: rows })
    }
    const rows = this.tables[table]
    if (!rows) return route.fulfill({ status: 404, headers: cors(), json: { message: `no table ${table}` } })

    // Filters: col=eq.value / col=is.true — all this app ever sends.
    const filters: [string, (value: unknown) => boolean][] = []
    for (const [column, expression] of url.searchParams) {
      if (['select', 'order', 'limit', 'columns'].includes(column)) continue
      const [op, ...rest] = expression.split('.')
      const operand = rest.join('.')
      if (op === 'eq') filters.push([column, (v) => String(v) === operand])
      else if (op === 'is') filters.push([column, (v) => String(v) === operand])
      else throw new Error(`fake PostgREST: unsupported filter ${column}=${expression}`)
    }
    const visible = (row: Row) => admin || row.published === true
    const matches = (row: Row) => visible(row) && filters.every(([column, test]) => test(row[column]))

    switch (request.method()) {
      case 'GET': {
        let found = rows.filter(matches)
        const order = url.searchParams.get('order')
        if (order) {
          const keys = order.split(',').map((term) => term.split('.') as [string, string])
          found = [...found].sort((a, b) => {
            for (const [column, direction] of keys) {
              const x = a[column] as string | number
              const y = b[column] as string | number
              if (x < y) return direction === 'desc' ? 1 : -1
              if (x > y) return direction === 'desc' ? -1 : 1
            }
            return 0
          })
        }
        const limit = Number(url.searchParams.get('limit') ?? Infinity)
        return route.fulfill({ headers: cors(), json: found.slice(0, limit) })
      }
      case 'POST': {
        if (!admin) {
          return route.fulfill({
            status: 403,
            headers: cors(),
            json: { code: '42501', message: `new row violates row-level security policy for table "${table}"` },
          })
        }
        const body = request.postDataJSON() as Record<string, unknown>
        const unknown = this.unknownColumn(table, body)
        if (unknown) return route.fulfill({ status: 400, headers: cors(), json: unknown })
        const [row] = this.seed(table, [{ ...body }])
        return route.fulfill({ status: 201, headers: cors(), json: [row] })
      }
      case 'PATCH': {
        const body = request.postDataJSON() as Record<string, unknown>
        const unknown = this.unknownColumn(table, body)
        if (unknown) return route.fulfill({ status: 400, headers: cors(), json: unknown })
        const hit = admin ? rows.filter(matches) : []
        for (const row of hit) Object.assign(row, body, { updated_at: new Date().toISOString() })
        return route.fulfill({ headers: cors(), json: hit })
      }
      case 'DELETE': {
        const hit = admin ? rows.filter(matches) : []
        this.tables[table] = rows.filter((row) => !hit.includes(row))
        return route.fulfill({ headers: cors(), json: hit })
      }
    }
    return route.fulfill({ status: 405, headers: cors(), json: {} })
  }

  private unknownColumn(table: string, body: Record<string, unknown>) {
    const column = Object.keys(body).find((c) => !COLUMNS[table].has(c))
    return column
      ? { code: 'PGRST204', message: `Could not find the '${column}' column of '${table}' in the schema cache` }
      : null
  }

  private storage(route: Route, endpoint: string) {
    const request = route.request()
    const publicPrefix = 'object/public/media/'
    if (request.method() === 'GET' && endpoint.startsWith(publicPrefix)) {
      const file = this.files.get(decodeURIComponent(endpoint.slice(publicPrefix.length)))
      if (!file) return route.fulfill({ status: 404, headers: cors(), json: { message: 'Object not found' } })
      return route.fulfill({ headers: { ...cors(), 'content-type': file.contentType }, body: file.body })
    }

    const admin = this.admins.has(this.userOf(request) ?? '')
    if (request.method() === 'POST' && endpoint.startsWith('object/media/')) {
      if (!admin) return route.fulfill({ status: 403, headers: cors(), json: { message: 'new row violates row-level security policy' } })
      const key = decodeURIComponent(endpoint.slice('object/media/'.length))
      const file = filePart(request)
      if (!file) return route.fulfill({ status: 400, headers: cors(), json: { message: 'no file in upload' } })
      this.files.set(key, file)
      return route.fulfill({ headers: cors(), json: { Key: `media/${key}`, Id: key } })
    }
    if (request.method() === 'DELETE' && endpoint === 'object/media') {
      const { prefixes } = request.postDataJSON() as { prefixes: string[] }
      const removed = admin ? prefixes.filter((key) => this.files.delete(key)) : []
      return route.fulfill({ headers: cors(), json: removed.map((name) => ({ name })) })
    }
    return route.fulfill({ status: 404, headers: cors(), json: { message: `no fake for storage/${endpoint}` } })
  }
}

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': '*',
    'access-control-expose-headers': '*',
  }
}
