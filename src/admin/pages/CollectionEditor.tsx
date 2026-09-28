import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ADMIN_ROOT } from '@/routes'
import type { Photo } from '@/content/types'
import { cn } from '@/lib/cn'
import { db } from '../client'
import { blankRow, titleOf, type Collection, type Field, type Row } from '../collections'
import { removePhotos } from '../images'
import { addEntries } from '../list'
import { ListField } from '../ListField'
import { PhotoField } from '../PhotoField'
import { confirmLeave, useUnsavedChanges } from '../unsaved'
import { button, card, hint, input, label } from '../styles'

const LANGS = [
  { code: 'el', name: 'Greek' },
  { code: 'en', name: 'English' },
] as const

/** Columns the editor never sends: the database owns them. */
const READ_ONLY = new Set(['id', 'position', 'created_at', 'updated_at'])

type Errors = Record<string, string>

const str = (row: Row, column: string) => (typeof row[column] === 'string' ? (row[column] as string) : '')
const strings = (row: Row, column: string) => (Array.isArray(row[column]) ? (row[column] as string[]) : [])

function validate(collection: Collection, row: Row): Errors {
  const errors: Errors = {}
  for (const field of collection.fields) {
    if (field.kind === 'localised' && field.required) {
      if (!str(row, `${field.name}_el`).trim() && !str(row, `${field.name}_en`).trim()) {
        errors[field.name] = 'Fill this in, in at least one language.'
      }
    }
    if (field.kind === 'photos' && field.required && (row.photos ?? []).length === 0) {
      errors.photos = 'Add at least one photo.'
    }
    if (field.kind === 'text' && field.required && !str(row, field.name).trim()) {
      errors[field.name] = 'Fill this in.'
    }
    if (field.kind === 'list' && field.required && strings(row, field.name).length === 0) {
      errors[field.name] = `Add at least one ${field.item}.`
    }
  }
  return errors
}

/** A required text filled in for one language only — allowed, but worth saying. */
function missingLanguage(field: Field, row: Row): string | null {
  if (field.kind !== 'localised' || !field.required) return null
  const el = str(row, `${field.name}_el`).trim()
  const en = str(row, `${field.name}_en`).trim()
  if (el && !en) return 'English is empty — the English site will show the Greek text.'
  if (en && !el) return 'Greek is empty — the Greek site will show the English text.'
  return null
}

function FieldShell({
  field,
  htmlFor,
  error,
  note,
  children,
}: {
  field: Field
  htmlFor?: string
  error?: string
  note?: string | null
  children: ReactNode
}) {
  const required = 'required' in field && field.required
  const Title = htmlFor ? 'label' : 'p'
  return (
    <div className={cn(card, 'p-4 sm:p-5', error && 'border-alert-600/70')}>
      <Title htmlFor={htmlFor} className={cn(label, 'mb-3 text-base text-white')}>
        {field.label}
        {required && <span className="text-alert-500"> *</span>}
      </Title>
      {children}
      {field.hint && <p className={hint}>{field.hint}</p>}
      {note && !error && <p className="text-navy-300 mt-2 text-xs">{note}</p>}
      {error && (
        <p role="alert" className="text-alert-500 mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Create or edit one row of a collection — the form is generated from the
 * collection's field list (see collections.ts).
 *
 * Photo files are the one thing that does not wait for Save: they upload as
 * soon as they are picked, so they can be previewed. The bookkeeping below
 * makes sure none are left behind — files taken off the row are deleted once
 * the row saves without them, and files uploaded into an editor that is then
 * abandoned are deleted when it closes.
 */
export default function CollectionEditor({ collection, id }: { collection: Collection; id: string }) {
  const isNew = id === 'new'
  const base = `${ADMIN_ROOT}/${collection.slug}`
  const navigate = useNavigate()
  const location = useLocation()
  const uid = useId()

  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>(isNew ? 'ready' : 'loading')
  const [row, setRow] = useState<Row>(() => blankRow(collection))
  const [initial, setInitial] = useState(() => JSON.stringify(blankRow(collection)))
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState<'save' | 'another' | 'delete' | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({})
  /** Text typed into list fields' boxes and not yet added, by column. */
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  /** Photos the row had when it was loaded. */
  const original = useRef<Photo[]>([])
  /** Photos uploaded by this editor, kept or not. */
  const uploads = useRef<Photo[]>([])
  const committed = useRef(false)

  const notice = (location.state as { notice?: string } | null)?.notice
  const dirty = JSON.stringify(row) !== initial || Object.values(drafts).some((text) => text.trim())
  useUnsavedChanges(dirty && saving === null)

  useEffect(() => {
    if (isNew) return
    let current = true
    db()
      .from(collection.table)
      .select('*')
      .eq('id', id)
      .then(({ data, error }) => {
        if (!current) return
        if (error) return setStatus('error')
        const found = data?.[0] as Row | undefined
        if (!found) return setStatus('missing')
        original.current = found.photos ?? []
        setRow(found)
        setInitial(JSON.stringify(found))
        setStatus('ready')
      })
    return () => {
      current = false
    }
  }, [collection.table, id, isNew])

  // Values already used in the columns that offer them — so "ABB" is picked,
  // not retyped as "A.B.B." on the next row.
  useEffect(() => {
    let current = true
    for (const field of collection.fields) {
      if (field.kind !== 'text' || !field.suggest) continue
      db()
        .from(collection.table)
        .select(field.name)
        .then(({ data }) => {
          if (!current || !data) return
          const values = [
            ...new Set((data as unknown as Record<string, unknown>[]).map((r) => String(r[field.name] ?? '').trim())),
          ]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
          setSuggestions((prev) => ({ ...prev, [field.name]: values }))
        })
    }
    return () => {
      current = false
    }
  }, [collection])

  // Closed without saving: whatever was uploaded is garbage.
  useEffect(
    () => () => {
      if (!committed.current) void removePhotos(uploads.current)
    },
    [],
  )

  const set = (column: string, value: unknown) => {
    setRow((prev) => ({ ...prev, [column]: value }))
    setSaveError(null)
  }

  const clearError = (name: string) => setErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev))

  const onPhotos = useCallback((update: (photos: Photo[]) => Photo[]) => {
    setRow((prev) => ({ ...prev, photos: update(prev.photos ?? []) }))
    setErrors((prev) => (prev.photos ? { ...prev, photos: '' } : prev))
  }, [])
  const onUploaded = useCallback((photo: Photo) => void uploads.current.push(photo), [])

  async function save(then: 'save' | 'another') {
    if (uploading) {
      setSaveError('Wait until the photos have finished uploading.')
      return
    }

    // Anything still typed in a list's box was meant to be in the list.
    let current = row
    for (const [column, text] of Object.entries(drafts)) {
      if (text.trim()) current = { ...current, [column]: addEntries(strings(current, column), text).values }
    }
    if (current !== row) {
      setRow(current)
      setDrafts({})
    }

    const found = validate(collection, current)
    setErrors(found)
    const first = Object.keys(found).find((k) => found[k])
    if (first) {
      document.getElementById(`${uid}-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setSaveError('Some fields need attention.')
      return
    }

    setSaving(then)
    setSaveError(null)

    const payload: Record<string, unknown> = {}
    for (const [column, value] of Object.entries(current)) {
      if (!READ_ONLY.has(column)) payload[column] = typeof value === 'string' ? value.trim() : value
    }

    const table = db().from(collection.table)
    let result
    if (isNew) {
      // New rows go to the top of the list: one above the current first.
      const { data: top } = await db()
        .from(collection.table)
        .select('position')
        .order('position', { ascending: true })
        .limit(1)
      payload.position = ((top?.[0] as { position?: number } | undefined)?.position ?? 1) - 1
      result = await table.insert(payload).select('id')
    } else {
      result = await table.update(payload).eq('id', id).select('id')
    }

    // An update the database's policies refuse is not an error to Postgres —
    // it simply matches no rows. Zero rows back is therefore a failure too.
    if (result.error || !result.data?.length) {
      setSaving(null)
      setSaveError(
        result.error
          ? `Could not save: ${result.error.message}`
          : 'Could not save: this item no longer exists, or your account may not edit it.',
      )
      return
    }

    // Files the saved row no longer mentions — removed from an existing row,
    // or uploaded and then removed before saving.
    const kept = new Set((current.photos ?? []).map((p) => p.full))
    const orphans = new Map<string, Photo>()
    for (const photo of [...original.current, ...uploads.current]) {
      if (!kept.has(photo.full)) orphans.set(photo.full, photo)
    }
    void removePhotos([...orphans.values()])
    committed.current = true

    const message = `Saved “${titleOf(current)}”${current.published ? '' : ' as a draft'}.`
    navigate(then === 'another' ? `${base}/new` : base, { state: { notice: message } })
  }

  async function remove() {
    if (!window.confirm(`Delete “${titleOf(row)}”? This cannot be undone.`)) return
    setSaving('delete')
    const { data, error } = await db().from(collection.table).delete().eq('id', id).select('id')
    if (error || !data?.length) {
      setSaving(null)
      setSaveError(error ? `Could not delete: ${error.message}` : 'Could not delete this item.')
      return
    }
    void removePhotos([...original.current, ...uploads.current])
    committed.current = true
    navigate(base, { state: { notice: `Deleted “${titleOf(row)}”.` } })
  }

  function cancel() {
    if (confirmLeave()) navigate(base)
  }

  const heading = `${isNew ? 'New' : 'Edit'} ${collection.noun}`

  if (status !== 'ready') {
    return (
      <div>
        <Link to={base} className="text-navy-400 hover:text-signal-400 text-sm">
          ← {collection.title}
        </Link>
        <p className="text-navy-300 mt-6">
          {status === 'loading'
            ? 'Loading…'
            : status === 'missing'
              ? 'This item does not exist any more.'
              : 'Could not load this item. Check your connection and reload the page.'}
        </p>
      </div>
    )
  }

  const busy = saving !== null

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void save('save')
      }}
      noValidate
    >
      <Link to={base} onClick={(e) => !confirmLeave() && e.preventDefault()} className="text-navy-400 hover:text-signal-400 text-sm">
        ← {collection.title}
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">{heading}</h1>
        {!isNew && row.published && (
          <Link to={collection.publicPath} target="_blank" rel="noreferrer" className="text-navy-400 hover:text-signal-400 text-sm">
            View on site ↗
          </Link>
        )}
      </div>

      {notice && (
        <p role="status" className="border-signal-500/40 bg-signal-500/10 text-signal-300 mt-5 rounded-md border px-4 py-3 text-sm">
          {notice}
        </p>
      )}

      <div className="mt-6 space-y-4">
        <label className={cn(card, 'flex cursor-pointer items-center gap-4 p-4 sm:p-5')}>
          <input
            type="checkbox"
            checked={row.published}
            onChange={(e) => set('published', e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="bg-navy-700 peer-checked:bg-signal-500 peer-focus-visible:outline-signal-400 relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
          />
          <span>
            <span className="block font-medium text-white">{row.published ? 'Published' : 'Draft'}</span>
            <span className="text-navy-400 block text-xs">
              {row.published ? 'Visible on the website.' : 'Only visible here, in the admin panel.'}
            </span>
          </span>
        </label>

        {collection.fields.map((field) => {
          const fid = `${uid}-${field.name}`
          const error = errors[field.name] || undefined

          if (field.kind === 'photos') {
            return (
              <div key={field.name} id={fid}>
                <FieldShell field={field} error={error}>
                  <PhotoField
                    id={`${fid}-input`}
                    table={collection.table}
                    photos={row.photos ?? []}
                    onChange={onPhotos}
                    onUploaded={onUploaded}
                    onBusyChange={setUploading}
                  />
                </FieldShell>
              </div>
            )
          }

          if (field.kind === 'localised') {
            return (
              <div key={field.name} id={fid}>
                <FieldShell field={field} error={error} note={missingLanguage(field, row)}>
                  <div className="grid gap-3 md:grid-cols-2">
                    {LANGS.map(({ code, name }) => {
                      const column = `${field.name}_${code}`
                      const props = {
                        id: `${fid}-${code}`,
                        lang: code,
                        // Every bilingual field has a "Greek" and an "English"
                        // box; the field's own name makes each one distinct.
                        'aria-label': `${field.label} (${name})`,
                        value: str(row, column),
                        disabled: busy,
                        'aria-invalid': error ? (true as const) : undefined,
                        onChange: (e: { target: { value: string } }) => {
                          set(column, e.target.value)
                          clearError(field.name)
                        },
                      }
                      return (
                        <div key={code}>
                          <label htmlFor={props.id} className="text-navy-400 mb-1.5 flex items-center gap-2 text-xs">
                            <span className="bg-navy-800 text-navy-200 rounded px-1.5 py-0.5 font-mono">
                              {code.toUpperCase()}
                            </span>
                            {name}
                          </label>
                          {field.multiline ? (
                            <textarea
                              {...props}
                              rows={5}
                              className={cn(input, 'min-h-32 resize-y field-sizing-content')}
                            />
                          ) : (
                            <input {...props} type="text" className={input} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </FieldShell>
              </div>
            )
          }

          if (field.kind === 'select') {
            return (
              <div key={field.name} id={fid}>
                <FieldShell field={field} htmlFor={`${fid}-input`} error={error}>
                  <select
                    id={`${fid}-input`}
                    value={str(row, field.name)}
                    onChange={(e) => set(field.name, e.target.value)}
                    disabled={busy}
                    className={input}
                  >
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FieldShell>
              </div>
            )
          }

          if (field.kind === 'list') {
            return (
              <div key={field.name} id={fid}>
                <FieldShell field={field} htmlFor={`${fid}-input`} error={error}>
                  <ListField
                    id={`${fid}-input`}
                    item={field.item}
                    values={strings(row, field.name)}
                    onChange={(values) => {
                      set(field.name, values)
                      clearError(field.name)
                    }}
                    draft={drafts[field.name] ?? ''}
                    onDraftChange={(text) => {
                      setDrafts((prev) => ({ ...prev, [field.name]: text }))
                      if (text.trim()) clearError(field.name)
                    }}
                    disabled={busy}
                  />
                </FieldShell>
              </div>
            )
          }

          const list = suggestions[field.name]
          return (
            <div key={field.name} id={fid}>
              <FieldShell field={field} htmlFor={`${fid}-input`} error={error}>
                <input
                  id={`${fid}-input`}
                  type="text"
                  value={str(row, field.name)}
                  onChange={(e) => {
                    set(field.name, e.target.value)
                    clearError(field.name)
                  }}
                  aria-invalid={error ? true : undefined}
                  disabled={busy}
                  list={list?.length ? `${fid}-list` : undefined}
                  autoComplete="off"
                  className={input}
                />
                {list && list.length > 0 && (
                  <datalist id={`${fid}-list`}>
                    {list.map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                )}
              </FieldShell>
            </div>
          )
        })}
      </div>

      {/* Pinned to the bottom of the screen: on a phone the form is several
          screens tall, and Save should never be a scroll away. */}
      <div className="border-navy-800 bg-navy-950/95 sticky bottom-0 -mx-4 mt-8 border-t px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        {saveError && (
          <p role="alert" className="text-alert-500 mb-2 text-sm">
            {saveError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className={button('primary')} disabled={busy}>
            {saving === 'save' ? 'Saving…' : 'Save'}
          </button>
          {isNew && (
            <button type="button" className={button('secondary')} disabled={busy} onClick={() => void save('another')}>
              {saving === 'another' ? 'Saving…' : 'Save and add another'}
            </button>
          )}
          <button type="button" className={button('ghost')} disabled={busy} onClick={cancel}>
            Cancel
          </button>
          {uploading && <span className="text-navy-400 text-xs">Uploading photos…</span>}
          {!isNew && (
            <button type="button" className={button('danger', 'ml-auto')} disabled={busy} onClick={() => void remove()}>
              {saving === 'delete' ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
