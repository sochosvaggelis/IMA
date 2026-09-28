import { useEffect, useRef, useState, type DragEvent } from 'react'
import { photoUrl } from '@/content/backend'
import type { Photo, Table } from '@/content/types'
import { cn } from '@/lib/cn'
import { PhotoError, removePhotos, uploadPhoto } from './images'
import { iconButton } from './styles'

type Pending = { key: number; file: File; preview: string; error?: string }

function Arrow({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={direction === 'left' ? 'M12 5l-5 5 5 5' : 'M8 5l5 5-5 5'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The photo list of one row: add (picker, camera on a phone, or drag and
 * drop), reorder, remove. The first photo is the cover.
 *
 * Uploads start the moment a photo is picked, one at a time and in the order
 * picked — one at a time because decoding a 12-megapixel photo takes a lot
 * of memory, and an older phone doing several at once can kill the tab.
 * Removing a photo here only takes it off the row; its files are deleted
 * when the row is saved (see CollectionEditor).
 */
export function PhotoField({
  id,
  table,
  photos,
  onChange,
  onUploaded,
  onBusyChange,
  describedBy,
}: {
  id: string
  table: Table
  photos: Photo[]
  /** Functional update: uploads finish at their own pace, so the list must
      be updated from its latest state, never from a stale copy. */
  onChange: (update: (photos: Photo[]) => Photo[]) => void
  /** Each photo stored by this field, whether or not it stays on the row. */
  onUploaded: (photo: Photo) => void
  onBusyChange: (busy: boolean) => void
  describedBy?: string
}) {
  const [pending, setPending] = useState<Pending[]>([])
  const [dragging, setDragging] = useState(false)
  const queue = useRef<Pending[]>([])
  const running = useRef(false)
  const alive = useRef(true)
  const nextKey = useRef(0)

  // Re-armed on every mount: StrictMode mounts, unmounts and mounts again.
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const working = pending.some((p) => !p.error)
  useEffect(() => {
    onBusyChange(working)
  }, [working, onBusyChange])

  async function drain() {
    if (running.current) return
    running.current = true
    while (queue.current.length > 0) {
      const item = queue.current.shift()!
      try {
        const photo = await uploadPhoto(item.file, table)
        if (!alive.current) {
          // The editor was closed mid-upload; nothing will ever save this.
          await removePhotos([photo])
          continue
        }
        onUploaded(photo)
        onChange((list) => [...list, photo])
        URL.revokeObjectURL(item.preview)
        setPending((list) => list.filter((p) => p.key !== item.key))
      } catch (error) {
        const message = error instanceof PhotoError ? error.message : 'Upload failed. Check your connection and try again.'
        setPending((list) => list.map((p) => (p.key === item.key ? { ...p, error: message } : p)))
      }
    }
    running.current = false
  }

  function add(files: Iterable<File>) {
    const items = Array.from(files)
      // HEIC often arrives with an empty type on Windows; let decode() decide.
      .filter((file) => file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name))
      .map((file) => ({ key: nextKey.current++, file, preview: URL.createObjectURL(file) }))
    if (items.length === 0) return
    setPending((list) => [...list, ...items])
    queue.current.push(...items)
    void drain()
  }

  function dismiss(key: number) {
    setPending((list) => {
      const item = list.find((p) => p.key === key)
      if (item) URL.revokeObjectURL(item.preview)
      return list.filter((p) => p.key !== key)
    })
  }

  function retry(item: Pending) {
    setPending((list) => list.map((p) => (p.key === item.key ? { ...p, error: undefined } : p)))
    queue.current.push({ ...item, error: undefined })
    void drain()
  }

  const move = (from: number, to: number) =>
    onChange((list) => {
      const next = [...list]
      const [photo] = next.splice(from, 1)
      next.splice(to, 0, photo)
      return next
    })

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    add(event.dataTransfer.files)
  }

  const tile = 'border-navy-800 bg-navy-900 relative aspect-square overflow-hidden rounded-md border'

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        // Leaving for a child is not leaving the field.
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false)
      }}
      onDrop={onDrop}
      className={cn('rounded-lg transition-colors', dragging && 'bg-signal-500/5 ring-signal-500 ring-2')}
    >
      {(photos.length > 0 || pending.length > 0) && (
        <ul className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo, index) => (
            <li key={photo.full} className={tile}>
              <img src={photoUrl(photo.thumb)} alt={`Photo ${index + 1}`} className="size-full object-cover" />
              {index === 0 && (
                <span className="bg-signal-500 text-navy-950 absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[0.6875rem] font-semibold">
                  Cover
                </span>
              )}
              <div className="bg-navy-950/85 absolute inset-x-0 bottom-0 flex justify-between">
                <button
                  type="button"
                  className={iconButton}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                  aria-label={`Move photo ${index + 1} earlier`}
                >
                  <Arrow direction="left" />
                </button>
                <button
                  type="button"
                  className={cn(iconButton, 'hover:text-alert-500')}
                  onClick={() => onChange((list) => list.filter((p) => p.full !== photo.full))}
                  aria-label={`Remove photo ${index + 1}`}
                >
                  <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={index === photos.length - 1}
                  onClick={() => move(index, index + 1)}
                  aria-label={`Move photo ${index + 1} later`}
                >
                  <Arrow direction="right" />
                </button>
              </div>
            </li>
          ))}

          {pending.map((item) => (
            <li key={item.key} className={tile} aria-busy={!item.error}>
              <img src={item.preview} alt="" className="size-full object-cover opacity-40" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center">
                {item.error ? (
                  <>
                    <p className="text-alert-500 text-xs leading-snug">{item.error}</p>
                    <div className="flex gap-1">
                      <button type="button" className="text-signal-400 min-h-9 px-2 text-xs font-medium" onClick={() => retry(item)}>
                        Retry
                      </button>
                      <button type="button" className="text-navy-300 min-h-9 px-2 text-xs" onClick={() => dismiss(item.key)}>
                        Dismiss
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="border-signal-400 size-6 animate-spin rounded-full border-2 border-t-transparent" aria-hidden="true" />
                    <p className="text-navy-200 text-xs">Uploading…</p>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <label
        htmlFor={id}
        className="border-navy-600 hover:border-signal-500 text-navy-300 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors hover:text-white"
      >
        <span className="text-sm font-medium">
          {photos.length > 0 ? '+ Add more photos' : '+ Add photos'}
        </span>
        <span className="text-navy-500 hidden text-xs sm:block">or drag them here</span>
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-describedby={describedBy}
        onChange={(event) => {
          if (event.target.files) add(event.target.files)
          // Picking the same file again must fire change again.
          event.target.value = ''
        }}
      />
    </div>
  )
}
