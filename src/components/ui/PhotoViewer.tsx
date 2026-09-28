import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { useI18n } from '@/i18n/useI18n'
import { photoUrl } from '@/content/backend'
import type { Photo } from '@/content/types'
import { cn } from '@/lib/cn'

/** Horizontal travel, in CSS px, that counts as a swipe rather than a tap. */
const SWIPE_PX = 50

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * One photo from `photos`, full screen, with the caption under it.
 *
 * Open while `index` is a number; `onIndexChange` pages through and `onClose`
 * is called for every way out (button, Esc, a click on the backdrop).
 *
 * A native modal <dialog>: the browser traps focus inside it, restores focus
 * to the thumbnail that opened it, and makes the page behind inert — all
 * things a hand-rolled overlay has to get right itself.
 *
 * The thumbnail (already in cache from the grid) is drawn first and the full
 * file fades in over it, so on ship wifi there is a picture at once rather
 * than a black box for the seconds a 2000px photo takes.
 */
export function PhotoViewer({
  photos,
  index,
  onIndexChange,
  onClose,
  alt,
  caption,
}: {
  photos: Photo[]
  index: number | null
  onIndexChange: (index: number) => void
  onClose: () => void
  alt: string
  caption?: ReactNode
}) {
  const { t } = useI18n()
  const dialog = useRef<HTMLDialogElement>(null)
  const swipeFrom = useRef<number | null>(null)
  const swiped = useRef(false)
  const [loaded, setLoaded] = useState<string | null>(null)

  const open = index !== null && photos.length > 0
  const current = open ? Math.min(index, photos.length - 1) : 0
  const photo = photos[current]
  const many = photos.length > 1

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  // A modal dialog stops clicks reaching the page, not wheel or touch
  // scrolling — the page would slide around behind the photo. Same lock as the
  // mobile menu in Header.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  // The next photo starts downloading while this one is being looked at.
  useEffect(() => {
    if (!open || !many) return
    const next = photos[(current + 1) % photos.length]
    new Image().src = photoUrl(next.full)
  }, [open, many, photos, current])

  const step = (delta: number) => onIndexChange((current + delta + photos.length) % photos.length)

  function onPointerDown(event: PointerEvent) {
    swipeFrom.current = event.clientX
  }

  function onPointerUp(event: PointerEvent) {
    if (swipeFrom.current === null) return
    const travel = event.clientX - swipeFrom.current
    swipeFrom.current = null
    swiped.current = Math.abs(travel) >= SWIPE_PX
    if (swiped.current && many) step(travel < 0 ? 1 : -1)
  }

  /** A click on the empty bands around a letterboxed photo is a click
      "outside" it, and closes the viewer, as tapping beside a photo does in
      any gallery app. The <img> spans the bands too, so where the picture
      actually is has to be worked out from its proportions. */
  function onStageClick(event: MouseEvent<HTMLDivElement>) {
    if (swiped.current) {
      swiped.current = false
      return
    }
    const box = (event.currentTarget.firstElementChild as HTMLElement).getBoundingClientRect()
    const scale = Math.min(box.width / photo.w, box.height / photo.h)
    const w = photo.w * scale
    const h = photo.h * scale
    const left = box.left + (box.width - w) / 2
    const top = box.top + (box.height - h) / 2
    const inside =
      event.clientX >= left && event.clientX <= left + w && event.clientY >= top && event.clientY <= top + h
    if (!inside) onClose()
  }

  const iconButton =
    'inline-flex size-11 items-center justify-center rounded-full text-navy-100 transition-colors hover:bg-navy-800/80 hover:text-white'

  return (
    <dialog
      ref={dialog}
      aria-label={alt}
      // Esc: the browser closes the dialog itself; keep the state in step.
      onClose={onClose}
      onKeyDown={(event) => {
        if (!many) return
        if (event.key === 'ArrowRight') step(1)
        if (event.key === 'ArrowLeft') step(-1)
      }}
      // A click that lands on the dialog element itself, not on anything in
      // it, is a click on the dimmed surround.
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className="bg-navy-950 backdrop:bg-navy-950 m-0 h-dvh max-h-none w-full max-w-none p-0 text-white"
    >
      {/* Only while open: an <img> inside a closed dialog still downloads,
          and that would fetch a 2000px photo on every page view. */}
      {open && photo && (
        <div
          className="flex h-full flex-col"
          onClick={(event) => event.target === event.currentTarget && onClose()}
        >
          <div className="flex items-center justify-between gap-4 px-3 py-2 sm:px-5">
            <p className="text-navy-400 font-mono text-xs" aria-live="polite">
              {many && `${current + 1} / ${photos.length}`}
            </p>
            <button type="button" onClick={onClose} className={iconButton} aria-label={t.gallery.close}>
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* The stage. pinch-zoom only: a one-finger drag is a swipe here,
              and a board photo is exactly what someone wants to zoom into. */}
          <div
            className="relative min-h-0 flex-1 touch-pinch-zoom"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (swipeFrom.current = null)}
          >
            {/* Both images fill the stage and letterbox themselves
                (object-contain), so the photo can never be taller than the
                space the caption leaves — whatever that caption's length. */}
            <div className="absolute inset-0 px-2 sm:px-16" onClick={onStageClick}>
              <div className="relative size-full">
                <img
                  src={photoUrl(photo.thumb)}
                  alt=""
                  className="absolute inset-0 size-full object-contain select-none"
                  draggable={false}
                />
                <img
                  key={photo.full}
                  src={photoUrl(photo.full)}
                  alt={alt}
                  onLoad={() => setLoaded(photo.full)}
                  className={cn(
                    'absolute inset-0 size-full object-contain transition-opacity duration-300 select-none',
                    loaded === photo.full ? 'opacity-100' : 'opacity-0',
                  )}
                  draggable={false}
                />
              </div>
            </div>

            {many && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  className={cn(iconButton, 'bg-navy-950/60 absolute top-1/2 left-2 -translate-y-1/2 sm:left-4')}
                  aria-label={t.gallery.previous}
                >
                  <Chevron direction="left" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  className={cn(iconButton, 'bg-navy-950/60 absolute top-1/2 right-2 -translate-y-1/2 sm:right-4')}
                  aria-label={t.gallery.next}
                >
                  <Chevron direction="right" />
                </button>
              </>
            )}
          </div>

          {caption && (
            <div className="border-navy-800/70 max-h-[40dvh] overflow-y-auto overscroll-contain border-t">
              <div className="mx-auto w-full max-w-3xl px-5 py-4 sm:px-8 sm:py-5">{caption}</div>
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}
