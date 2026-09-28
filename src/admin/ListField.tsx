import { useState } from 'react'
import { cn } from '@/lib/cn'
import { addEntries } from './list'
import { button, iconButton, input } from './styles'

function Arrow({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={up ? 'M5 12l5-5 5 5' : 'M5 8l5 5 5-5'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * An ordered list of short values — the makers in a capabilities group.
 *
 * Type and press Enter to add; paste "ABB, Siemens, Omron" (or one per line)
 * to add several at once. Rows, not chips, so every button keeps the 44px
 * touch size on a phone.
 *
 * The text box is controlled by the editor, which adds whatever is still in
 * it when the row is saved — so a maker typed but never confirmed with Enter
 * is not lost. (Adding it on blur instead looks simpler and is a trap: the
 * new row shifts the Save button between mousedown and mouseup, and the
 * click that caused the blur never lands.)
 */
export function ListField({
  id,
  item,
  values,
  onChange,
  draft,
  onDraftChange,
  disabled,
}: {
  id: string
  /** What one entry is called: "maker". */
  item: string
  values: string[]
  onChange: (values: string[]) => void
  /** What is typed in the box but not yet added. */
  draft: string
  onDraftChange: (draft: string) => void
  disabled?: boolean
}) {
  const [note, setNote] = useState<string | null>(null)

  function add() {
    if (!draft.trim()) return
    const result = addEntries(values, draft)
    onChange(result.values)
    onDraftChange('')
    setNote(result.skipped.length ? `Already in the list: ${result.skipped.join(', ')}.` : null)
  }

  function move(from: number, to: number) {
    const next = [...values]
    const [value] = next.splice(from, 1)
    next.splice(to, 0, value)
    onChange(next)
  }

  return (
    <div>
      {values.length > 0 && (
        <ol className="border-navy-800 divide-navy-800 mb-3 divide-y rounded-md border">
          {values.map((value, index) => (
            <li key={value} className="flex items-center gap-1 pl-3">
              <span className="min-w-0 flex-1 truncate text-sm text-white">{value}</span>
              <button
                type="button"
                className={iconButton}
                disabled={disabled || index === 0}
                onClick={() => move(index, index - 1)}
                aria-label={`Move ${value} up`}
              >
                <Arrow up />
              </button>
              <button
                type="button"
                className={iconButton}
                disabled={disabled || index === values.length - 1}
                onClick={() => move(index, index + 1)}
                aria-label={`Move ${value} down`}
              >
                <Arrow up={false} />
              </button>
              <button
                type="button"
                className={cn(iconButton, 'hover:text-alert-500')}
                disabled={disabled}
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={`Remove ${value}`}
              >
                <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={draft}
          disabled={disabled}
          placeholder={`Add a ${item}…`}
          autoComplete="off"
          onChange={(e) => {
            onDraftChange(e.target.value)
            setNote(null)
          }}
          onKeyDown={(e) => {
            // Enter adds the entry — it must not submit the whole form.
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          className={input}
        />
        <button type="button" className={button('secondary', 'shrink-0')} disabled={disabled || !draft.trim()} onClick={add}>
          Add
        </button>
      </div>
      {note && <p className="text-navy-300 mt-2 text-xs">{note}</p>}
    </div>
  )
}
