import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n/useI18n'
import { E2E } from '@/lib/e2e'
import { onVesselReady } from '@/lib/vesselReady'
import { Logo } from '@/components/layout/Logo'
import { COMPANY_NAME_LINES } from '@/lib/company'

/**
 * The opening curtain.
 *
 * The vessel takes a beat to arrive — the model has to download and every edge
 * in it has to be extracted before there is a drawing to look at. Rather than
 * hide that behind a spinner, the wait is spent on the two things the page most
 * wants to say: the company mark and the statement. They open full-screen, and
 * when the vessel is ready they travel to the places they occupy for the rest
 * of the visit — the mark to the header, the statement to its panel.
 *
 * ---------------------------------------------------------------------------
 * THE MOVE IS A FLIP, MEASURED AGAINST THE REAL ELEMENTS. Nothing here knows
 * where the header logo or the hero heading sit; it reads their rects at the
 * moment the move starts and solves the transform that lands on them. That is
 * what keeps it correct across breakpoints, both languages, and the desktop /
 * mobile split — all of which put those targets in different places, and none
 * of which this file has to know about.
 *
 * The travelling copies are never handed over to: they fade out as they arrive
 * on top of the real elements, which have been there the whole time. A true
 * handover would mean owning the header's logo for the length of an animation,
 * and every scroll and navigation during it.
 * ---------------------------------------------------------------------------
 */

/** Selectors for what the two travelling pieces are flying to. Both are
    attributes rather than structural selectors, so moving the markup does not
    silently break the landing. */
const LOGO_TARGET = 'header [data-logo-mark]'
const TITLE_TARGET = '[data-hero-title]'

/** The shortest the curtain is ever on screen, even off a warm cache.
    Long enough to READ, which is the point of it — the entrance alone runs to
    1160ms (the statement's own 900 behind a 260 delay), so anything much under
    this starts the pieces leaving before they have finished arriving. */
const MIN_SHOW_MS = 1800

/** When the curtain leaves regardless. WebGL can be missing, the model can 404,
    a driver can lose the context — the page must not stay behind a cover in any
    of them, so readiness is the fast path and never the only one. */
const MAX_WAIT_MS = 6000

/** The travel itself. The curtain does not outlive it — it is taken off screen
    by the handover, on the same frame the real elements are revealed. */
const TRAVEL_MS = 1100

/**
 * When the spelled-out name goes, and how long it takes.
 *
 * Below `sm` the header has no room for it (Logo's `compact`), so the curtain
 * is the one place it is ever seen — it opens on the full name and lets it go
 * on the way out, rather than carrying it to a header that would have to drop
 * it on arrival.
 *
 * It goes early — a short beat after the flight begins, clearing the frame
 * while the mark and the statement are still travelling, so the eye is left
 * with the two things that are going somewhere.
 *
 * The two together must stay inside TRAVEL_MS. The curtain is taken off screen
 * the moment the flight ends, and a fade still running at that point would not
 * fade at all — it would be cut off mid-way.
 */
const NAME_FADE_DELAY_MS = 120
const NAME_FADE_MS = 340

/**
 * The statement is CENTRED in the curtain and LEFT-ALIGNED where it lands, so
 * on a phone its lines SLIDE from one to the other as the flight starts.
 *
 * They cannot simply be swapped. An earlier pass drew the statement twice —
 * once centred, once left-aligned — and dissolved between them. Both copies
 * were the same size and in the same box, so the dissolve gave away no size or
 * position change, and it still read as a teleport: a dissolve between two
 * texts whose LINES sit at different offsets is a jump however quick it is,
 * because nothing travels between the two positions.
 *
 * Moving the lines instead means there is no second position to appear at. The
 * offsets are per line and animate to zero, so the text arrives left-aligned —
 * the same shape as the heading it lands on, which is what keeps the landing
 * exact — having visibly travelled there.
 *
 * Timed to start with the flight and finish early in it, so the settling is
 * done well before anything comes to rest.
 */
const ALIGN_SLIDE_DELAY_MS = 60
const ALIGN_SLIDE_MS = 420

/**
 * Extra size the statement opens at on a phone, over the size it lands at.
 *
 * ---------------------------------------------------------------------------
 * WHAT MAKES THIS POSSIBLE IS THAT THE LINES ARE CENTRED, NOT THE BOX.
 *
 * The copy is given its target's width so that it wraps identically, and that
 * box is far wider than the text inside it — 366px of box around a 202px
 * longest line, on a phone. While the lines were left-aligned they started at
 * the box's edge, so the BOX had to fit on screen, and that capped the whole
 * thing at about 1.2x. Now that each line is centred within the box (see
 * centreLines), the box may hang off both sides freely: the only thing that has
 * to fit is the longest line.
 *
 * So the ceiling is measured off the text rather than assumed, and it comes out
 * around 1.6x higher than the old one. The wrap does not change — the layout
 * width is untouched and only the scale differs — so the copy is still the same
 * shape as its target, and the FLIP shrinks it to exactly that on the way in.
 * The statement opens large and settles into place.
 * ---------------------------------------------------------------------------
 */
const TITLE_MAX_BOOST = 1.8
/** The curtain's own horizontal padding (px-6), which the text must clear. */
const CURTAIN_PADDING_PX = 24

/**
 * Set on the document element for as long as the curtain owns the mark and the
 * statement. The stylesheet hides the real ones while it is there — see the
 * rule in index.css.
 *
 * This is what makes the move read as ONE object rather than a copy chasing an
 * original. The two are pixel-identical at the end of the flight and sitting in
 * exactly the same place, so dropping the attribute swaps the travelling piece
 * for the real element with nothing visible happening: what the eye followed
 * across the screen is, as far as it can tell, what stays behind in the header.
 *
 * Hidden with OPACITY, never display or visibility: the flight is solved
 * against these elements' rects, and a target that is not laid out has no rect
 * to aim at.
 */
const OWNED_ATTR = 'data-intro-owns-lockup'

/** How much larger than the header's the opening mark is. Two values because
    the lockup is ~200px wide as drawn, and 3.2x of that overruns a phone. */
const LOGO_OPEN_SCALE = 3.2
const LOGO_OPEN_SCALE_NARROW = 1.7
/** Tailwind's sm, where the wider scale takes over. */
const NARROW_WIDTH = 640

/**
 * How the opening statement is sized.
 *
 * ---------------------------------------------------------------------------
 * THE CURTAIN'S COPY IS GIVEN ITS TARGET'S WIDTH, AND IS THEN SCALED UP. That
 * is the whole trick, and it is what makes the landing exact.
 *
 * The obvious way — set the copy in a big display size and let it wrap however
 * it likes — cannot land cleanly however carefully the transform is solved. Two
 * blocks of text at different widths break over different lines, so they are
 * not the same shape, and no single scale factor maps one onto the other. The
 * copy arrives close, the real heading appears underneath it at slightly
 * different line breaks, and the swap flickers.
 *
 * Matching the width instead makes the two IDENTICAL up to a uniform scale:
 * same wrap, same balance, same proportions. The transform then has an exact
 * answer, and the handover has nothing left to give away. It is also why the
 * copy below carries the same type classes as the real heading rather than the
 * larger display size it would otherwise want.
 * ---------------------------------------------------------------------------
 */
/** Widest the opening statement is allowed to be drawn. */
const TITLE_MAX_WIDTH = 1400
/** Share of the viewport it may take, allowing for the curtain's own padding. */
const TITLE_VIEWPORT_FRACTION = 0.9
/** Ceiling on the enlargement. Past this the type outgrows the frame on a wide
    display and the statement stops reading as one block. */
const TITLE_MAX_SCALE = 2.2
/** Fallback width, used only if the real heading cannot be found to measure. */
const TITLE_FALLBACK_WIDTH = 640
/**
 * Margin kept between the statement's right edge and the edge of the screen,
 * once it has been slid right to start under the mark.
 *
 * Far tighter on a phone, because there the margin is the ONLY thing standing
 * between the statement and the largest it can be drawn. On a desktop the
 * statement is nowhere near the edge — TITLE_MAX_SCALE stops it long before —
 * so the gap there is free to be generous.
 */
const TITLE_EDGE_GAP = 48
const TITLE_EDGE_GAP_NARROW = 12

/**
 * How long to keep looking for the heading before giving up on it.
 *
 * It is NOT in the DOM on the first commit. VesselScene resolves WebGL support
 * in an effect and renders a fallback scene until it has, and the hero panel —
 * the heading with it — only exists on the render after that. A measurement
 * taken at mount therefore finds nothing and falls back, and the fallback is
 * poison here: the statement gets laid out at a width it will never land at,
 * so its lines break in the wrong places and its line boxes are the wrong
 * height. The FLIP still matches the WIDTH exactly — that is what it solves
 * for — which is what makes the failure so quiet: everything looks almost
 * right, and the leftover height error shows up as the piece sitting a few
 * pixels high.
 *
 * So: look again every frame until it turns up. The deadline only exists for
 * the case where it never will (no WebGL at all, where there is no hero panel).
 */
const MEASURE_DEADLINE_MS = 1000

export function IntroCurtain() {
  const { t } = useI18n()

  const root = useRef<HTMLDivElement>(null)
  const logo = useRef<HTMLDivElement>(null)
  const name = useRef<HTMLParagraphElement>(null)
  const title = useRef<HTMLDivElement>(null)
  const titleExact = useRef<HTMLParagraphElement>(null)
  /** Undoes the statement's line centring — see centreLines. */
  const unCentre = useRef<((transition: string) => void) | null>(null)
  /** How much larger than its landing size the statement opens — see
      TITLE_MAX_BOOST. Measured after it has been laid out, so it starts at 1
      and is corrected before the first paint. */
  const [boost, setBoost] = useState(1)
  /** The statement's DRAWN height, reserved as layout. A scale contributes
      none of its own, so without this the enlarged statement overflows its box
      by half the difference at each end and crowds the name row above it. */
  const [titleHeight, setTitleHeight] = useState(0)

  // `leaving` only drives the entrance-to-exit class swap; the transforms
  // themselves are written straight to style below, since they are measured.
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)

  // Read once, at mount. The curtain lives for a second and a half; a viewport
  // that changes class mid-flight is not a case worth carrying state for.
  const [openScale] = useState(() =>
    window.innerWidth < NARROW_WIDTH ? LOGO_OPEN_SCALE_NARROW : LOGO_OPEN_SCALE,
  )

  // The statement's box, borrowed from the heading it will land on — see the
  // note on TITLE_MAX_WIDTH for why it is measured rather than chosen.
  //
  // A layout effect, so the width is in place before the browser paints: set
  // in a plain effect the statement would show for one frame at the curtain's
  // own width and visibly reflow.
  const [titleBox, setTitleBox] = useState<{
    width: number
    scale: number
    /** See shift below. */
    shift: number
  } | null>(null)
  useLayoutEffect(() => {
    const deadline = performance.now() + MEASURE_DEADLINE_MS
    let raf = 0

    const measure = () => {
      const target = document.querySelector(TITLE_TARGET)
      // Keep looking. See MEASURE_DEADLINE_MS: the heading arrives a commit or
      // two after this one, and measuring the fallback instead is what puts the
      // statement a few pixels high on landing.
      if (!target && performance.now() < deadline) {
        raf = requestAnimationFrame(measure)
        return
      }

      const width = target?.getBoundingClientRect().width || TITLE_FALLBACK_WIDTH

      /**
       * On a wide screen the statement begins where the mark begins: the mark
       * stays centred and the statement slides right until their left edges
       * meet, so the two read as one left-aligned block.
       *
       * Not on a phone. There the header lockup is the badge and initials alone
       * (Logo's `compact`), barely 147px of a 390px screen, and starting the
       * statement at ITS left edge left so little room that the statement was
       * forced back down to the size it lands at. The phone centres the block
       * instead, and says the company name on its own centred row between the
       * two.
       */
      const vw = window.innerWidth
      const narrow = vw < NARROW_WIDTH
      const edge = narrow ? TITLE_EDGE_GAP_NARROW : TITLE_EDGE_GAP

      const logoWidth =
        (document.querySelector(LOGO_TARGET)?.getBoundingClientRect().width ?? 0) * openScale
      const logoLeft = (vw - logoWidth) / 2

      const room = Math.min(
        // The share cap is a desktop concern — it stops the statement filling a
        // wide screen edge to edge. On a phone it is the binding constraint
        // rather than a safety margin, and it costs real size, so the edge gap
        // is left to do the job alone there.
        narrow ? vw - edge * 2 : vw * TITLE_VIEWPORT_FRACTION,
        TITLE_MAX_WIDTH,
        // What is left between the mark's left edge and the far margin.
        !narrow && logoWidth ? vw - edge - logoLeft : Infinity,
      )
      // Never below 1: on a narrow phone the panel heading already spans almost
      // the whole screen, and there is no room to open larger than it lands.
      const scale = clamp(room / width, 1, TITLE_MAX_SCALE)

      // Clamped rather than trusted: the scale has a floor of 1, so the
      // statement can still come out wider than the room allowed for, and it
      // should stop at the margin rather than run past it.
      const drawn = width * scale
      const centred = (vw - drawn) / 2
      const shift =
        narrow || !logoWidth
          ? 0
          : clamp((drawn - logoWidth) / 2, 0, Math.max(0, vw - edge - centred - drawn))

      setTitleBox({ width, scale, shift })
    }

    measure()
    return () => cancelAnimationFrame(raf)
  }, [openScale])


  /**
   * Centre the statement's lines, phone only — above `sm` it opens left-aligned
   * beside a mark it shares an edge with, and there is nothing to centre.
   *
   * After the statement exists (titleBox gates it) and after the webfonts have
   * landed, since both the wrap and the width of every line depend on them.
   */
  useLayoutEffect(() => {
    if (!titleBox || window.innerWidth >= NARROW_WIDTH) return

    const apply = () => {
      unCentre.current = centreLines(titleExact.current)
      // Measured off the longest line rather than the box — see
      // TITLE_MAX_BOOST for why that is the number that matters.
      const longest = longestLine(titleExact.current)
      if (longest > 0 && titleExact.current) {
        const usable = window.innerWidth - CURTAIN_PADDING_PX * 2
        const next = clamp(usable / longest, 1, TITLE_MAX_BOOST)
        setBoost(next)
        setTitleHeight(titleExact.current.offsetHeight * titleBox.scale * next)
      }
    }
    apply()
    void document.fonts?.ready.then(apply)
  }, [titleBox])

  /**
   * The page must not scroll under the curtain — a wheel spin during the wait
   * would otherwise land the reader mid-sweep the instant it lifts, with the
   * camera already past the opening frame.
   *
   * -------------------------------------------------------------------------
   * DONE BY REFUSING THE INPUT, NOT BY `overflow: hidden`, BECAUSE THE
   * SCROLLBAR MUST NOT GO ANYWHERE.
   *
   * Hiding overflow takes the bar away, and on a platform with classic
   * scrollbars that is a 15px layout change: the whole page is wider for the
   * length of the intro and snaps back when it ends. Everything centred or
   * right-anchored — the header row, the hero panel — moves with it. It is
   * also not fixable with `scrollbar-gutter: stable`, which the root ignores
   * once its overflow is hidden (measured: clientWidth stayed at the full
   * 1440 throughout, then dropped to 1425 on teardown).
   *
   * Blocking the input instead leaves the bar exactly where it is, so the
   * layout is identical before, during and after — which is what the flight
   * needs, since it is solved against positions measured while the curtain is
   * still up. Dragging the bar itself still scrolls; that is a deliberate
   * enough act to allow.
   * -------------------------------------------------------------------------
   */
  useEffect(() => {
    if (gone) return

    const swallow = (e: Event) => e.preventDefault()
    // The keys that scroll. Space is in here as itself, not as 'Spacebar'.
    const SCROLL_KEYS = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'PageUp', 'PageDown', 'Home', 'End', ' ',
    ])
    const onKey = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.has(e.key)) e.preventDefault()
    }

    // passive: false, or preventDefault is ignored — wheel and touchmove are
    // passive by default on window in every current browser.
    window.addEventListener('wheel', swallow, { passive: false })
    window.addEventListener('touchmove', swallow, { passive: false })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('wheel', swallow)
      window.removeEventListener('touchmove', swallow)
      window.removeEventListener('keydown', onKey)
    }
  }, [gone])

  // Claimed for the whole life of the curtain, and released below at the exact
  // moment the pieces land. The cleanup is unconditional so an early unmount —
  // a navigation during the intro — cannot leave the site permanently missing
  // its own logo.
  useEffect(() => {
    document.documentElement.setAttribute(OWNED_ATTR, '')
    return () => document.documentElement.removeAttribute(OWNED_ATTR)
  }, [])

  useEffect(() => {
    // Nothing can fly until the statement has been given its target's width —
    // the measurement is what the whole flight is solved against.
    if (!titleBox) return

    const mounted = performance.now()
    let timers: number[] = []
    let landed: (() => void) | undefined

    const start = () => {
      // Under reduced motion the curtain still does its job — it covers the
      // load — but it lifts with a plain fade rather than flying two elements
      // across the screen.
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // Measured here rather than on mount: webfonts land after first paint
        // and move the header lockup, and on mobile the heading's position
        // depends on a strip whose height is in dvh.
        flyTo(logo.current, document.querySelector(LOGO_TARGET), openScale)
        flyTo(
          title.current,
          document.querySelector(TITLE_TARGET),
          titleBox.scale * boost,
          titleBox.shift,
        )
      }

      // The name has nowhere to land — below `sm` the header does not carry
      // it — so it leaves with the curtain rather than travelling. Its own
      // element, so fading it moves nothing and cannot disturb either landing.
      // The statement's lines slide from centred to where they land, on the
      // same curve as the flight so the two read as one movement.
      unCentre.current?.(
        `transform ${ALIGN_SLIDE_MS}ms cubic-bezier(0.65, 0, 0.35, 1) ${ALIGN_SLIDE_DELAY_MS}ms`,
      )

      if (name.current) {
        name.current.style.transition = `opacity ${NAME_FADE_MS}ms ease-in ${NAME_FADE_DELAY_MS}ms`
        name.current.style.opacity = '0'
      }
      setLeaving(true)

      /**
       * The handover, and it has to be ONE frame.
       *
       * Both DOM writes are done here, synchronously, in this order: the
       * curtain is hidden and the real elements are revealed. They land in the
       * same task, so they are painted in the same frame — the travelling piece
       * is never on screen at the same time as the thing it was standing in for.
       *
       * That overlap was worth 1-2px of ghosting on its own. The rects agree
       * exactly, but a travelling piece is a composited layer carrying a
       * transform, and such a layer is rasterised once and then scaled — so its
       * edges never resolve to quite the same device pixels as freshly painted,
       * untransformed text sitting underneath it. Draw both at once and the
       * near-miss shows as a faint doubled edge.
       *
       * React's own unmount (setGone) follows for cleanup, but it is NOT what
       * takes the piece off screen — that would be a state update landing a
       * frame later, which is the overlap all over again.
       */
      const hand = () => {
        landed?.()
        if (root.current) root.current.style.display = 'none'
        document.documentElement.removeAttribute(OWNED_ATTR)
        setGone(true)
      }

      // Driven by the transition ENDING rather than by a timer set to the same
      // duration. The two are not the same instant: a timer is scheduled off
      // the clock and fires on whichever frame comes next, which is routinely a
      // frame or two before the compositor has painted the final position — so
      // the real element appears while the travelling one is still a pixel or
      // two short of it, and that mismatch is the flicker.
      const piece = logo.current
      if (piece) {
        landed = () => {
          piece.removeEventListener('transitionend', onEnd)
          landed = undefined
        }
        const onEnd = (e: TransitionEvent) => {
          if (e.target !== piece || e.propertyName !== 'transform') return
          hand()
        }
        piece.addEventListener('transitionend', onEnd)
      }

      // Backstop. transitionend does not fire if the transition never runs —
      // reduced motion takes that path deliberately, and a background tab can
      // too — and the site must not be left without its logo either way.
      timers.push(window.setTimeout(hand, TRAVEL_MS + 150))
    }

    const open = () => {
      // Hold the floor for the minimum even if the vessel beat us to it.
      const waited = performance.now() - mounted
      timers.push(window.setTimeout(start, Math.max(0, MIN_SHOW_MS - waited)))
    }

    const unsubscribe = onVesselReady(open)
    timers.push(window.setTimeout(open, MAX_WAIT_MS))

    return () => {
      unsubscribe()
      landed?.()
      timers.forEach(clearTimeout)
      timers = []
    }
  }, [openScale, titleBox, boost])

  if (gone) return null

  return (
    <div
      ref={root}
      data-testid="intro-curtain"
      // Above the header (z-50), which is otherwise the top of the site: the
      // curtain covers everything, including the nav it is about to hand the
      // logo back to.
      className="pointer-events-none fixed inset-0 z-100 flex flex-col items-center justify-center gap-8 overflow-hidden px-6"
      // Decorative twice over: the mark and the statement are both rendered
      // again, for real, in the page underneath.
      aria-hidden="true"
    >
      {/* The cover is a LAYER, not the root. Fading the root would fade the two
          travelling pieces along with it — opacity compounds down the tree —
          and they would evaporate in mid-flight instead of landing. This way
          the cover clears early, revealing the vessel, and the pieces finish
          their journey over the live page.

          The blueprint field is the one the hero uses, so the curtain reads as
          the same drawing surface the vessel is about to appear on. */}
      <div
        className={`bg-navy-950 absolute inset-0 transition-opacity duration-700 ease-out ${
          leaving ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="blueprint-grid absolute inset-0 opacity-60" />
      </div>

      {/* Three layers per travelling piece, and each one has a job the other
          two cannot do:

            outer  — reserves LAYOUT and carries the entrance. A scale does not
                     affect layout, so without a sized box here the enlarged
                     mark would keep its 48px slot and print straight over the
                     statement below it.
            middle — measured and flown. Its own opening scale is inline so it
                     shows up in getBoundingClientRect: the FLIP solves against
                     what is on screen, and a scale applied further in would be
                     invisible to it and land the piece at the wrong size.
            inner  — the content, untransformed. */}
      {/* The reserved height has to follow the opening scale, since a scale
          contributes no layout of its own. h-52 fits the desktop mark at 3.2x
          (~166px); the phone's is 1.7x of a compact lockup, about 82px, and
          holding the same box there left ~126px of dead space between the mark
          and the name below it. */}
      <div className="intro-rise flex h-24 items-center justify-center sm:h-52">
        <div
          ref={logo}
          // Handles for measuring the flight from outside — the landing is a
          // geometry problem, and eyeballing it is how the last two offsets
          // went unnoticed.
          data-intro-piece="logo"
          // flex, so this box is exactly its child and nothing more. As a block
          // it would wrap the inline-flex lockup in a LINE box, and the strut's
          // half-leading made the measured piece 4px taller than the header's —
          // half of which lands as a 2px upward shift.
          className="flex"
          style={{
            transform: `scale(${openScale})`,
            transformOrigin: 'center center',
            willChange: 'transform',
          }}
        >
          {/* The same mode the header uses — the landing assumes the two
              lockups are the same shape. The spelled-out name is set below as
              a line of its own instead. */}
          <Logo name="compact" />
        </div>
      </div>

      {/* The spelled-out name, as a line of its own between the mark and the
          statement.

          Phone only: above `sm` the header carries the name inside its lockup,
          so the curtain's lockup does too and this would be saying it twice.
          Below `sm` the header has dropped it (Logo's `compact`) — this is the
          one place on a phone the company is named in full, which is why it is
          worth a line rather than being left off.

          It does not travel. There is nothing on a phone for it to land on, so
          it fades where it stands while the other two fly (see NAME_FADE_MS).
          Which also means it is under no landing constraint, and can simply be
          centred like everything else. */}
      {/* The entrance is on the wrapper and the exit is written to the element
          inside, and they must not be the same element: `.intro-rise` fills
          `both`, so it goes on asserting opacity 1 for good — and an
          animation's value beats a plain declaration, so the fade below would
          silently never happen. */}
      <div className="intro-rise sm:hidden">
        {/* Centred and set large: it is under no landing constraint — nothing
            on a phone for it to fly to — so unlike the statement it is free to
            be composed for this frame alone. */}
        {/* Set as ONE run of words and left to wrap, rather than forced onto
            the lockup's two lines. At this size "Marine Automations" does not
            fit a phone on one line, and the natural break — International /
            Marine / Automations — is what lets the type be this big at all.
            Tracking comes in as the size goes up: 0.14em reads as small caps at
            20px and as a gap at 32. */}
        <p
          ref={name}
          className="text-navy-200 text-center font-mono text-[2rem] leading-tight tracking-[0.06em] uppercase"
        >
          {COMPANY_NAME_LINES.join(' ')}
        </p>
      </div>

      {titleBox && (
        <div
          className="intro-rise intro-rise-delayed flex items-center justify-center"
          // Reserves what the scaled statement actually draws — see titleHeight.
          style={titleHeight ? { minHeight: titleHeight } : undefined}
        >
          <div
            ref={title}
            data-intro-piece="title"
            className="relative"
            style={{
              // Its target's width, blown up. Identical wrap, identical
              // balance, so the flight has an exact answer to land on.
              width: titleBox.width,
              // translate BEFORE scale, so the shift is read in the parent's
              // units rather than the statement's own enlarged ones.
              transform: `translateX(${titleBox.shift}px) scale(${titleBox.scale * boost})`,
              transformOrigin: 'center center',
              willChange: 'transform',
            }}
          >
            {/* ONE copy, left-aligned exactly as the heading it lands on. Its
                type classes match that heading's for the same reason — anything
                else changes where the lines break.

                It is CENTRED by nudging each line, not by text-align: every
                word is its own inline-block, and each is offset by half the
                slack left on the line it happens to fall on (see centreLines).
                The offsets then animate to zero as the flight starts, so the
                lines travel to where they land instead of being swapped for a
                differently-positioned copy — which is what read as a teleport.

                Doing it per word rather than per line is what keeps the wrap
                honest: the words break where they naturally break at this
                width, so the copy is still the same shape as its target and the
                landing is still exact. Nothing here hard-codes a line.

                A p rather than an h1: the real heading is in the page below,
                and two would leave the document with a duplicate. */}
            <p ref={titleExact} className="text-h2 font-semibold text-balance text-white">
              <Words text={t.hero.title} />{' '}
              <span className="text-signal-400 block">
                <Words text={t.hero.titleAccent} />
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Transforms `el` so it lands exactly on `target`.
 *
 * Scale comes from width alone, not width and height independently: the
 * curtain's copy of the heading wraps over different lines than the panel's
 * narrower one, so their heights are not in the same ratio and a two-axis scale
 * would visibly squash the type on the way down. One factor keeps it type.
 *
 * Silently does nothing if either element is missing — a curtain that fades
 * straight out is a fine outcome, and far better than one that throws on the
 * way and stays on screen forever.
 */
function flyTo(
  el: HTMLElement | null,
  target: Element | null,
  openScale: number,
  openShiftX = 0,
) {
  if (!el || !target) return

  const from = el.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  if (!from.width || !to.width) return

  // `from` is the element AS DRAWN — a rect includes the element's own
  // transform, which at this point is the opening scale and offset. The
  // transform written below REPLACES that rather than compounding with it, so
  // both parts of the opening pose have to be carried through by hand.

  // openScale * (to / from) is the factor that leaves the piece exactly as
  // wide as its target.
  const scale = (openScale * to.width) / from.width

  // And openShiftX is added back because the measured centre is ALREADY
  // displaced by it. The translation below is applied to the element's layout
  // position, not to where it currently appears, so a plain centre-to-centre
  // delta would drop the opening offset and land the piece short by exactly
  // that much. (A pure scale needs no such correction — scaling about the
  // centre leaves the centre where it is — which is why this was invisible
  // until the mark was given an offset.)
  const dx = to.left + to.width / 2 - (from.left + from.width / 2) + openShiftX
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)

  // Transform only — no fade. The piece is not a copy dissolving over an
  // original; while it is in the air it IS the site's only logo, and the real
  // one is waiting invisibly underneath for the swap at the end of the flight.
  // Fading it out would put the eye through a dissolve where there is nothing
  // to dissolve between.
  el.style.transition = `transform ${TRAVEL_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`
  el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * The text, with every word its own inline-block so a line can be moved.
 *
 * The spaces are left OUTSIDE the spans, as ordinary text nodes. A trailing
 * space inside an inline-block is not collapsible and counts toward the box's
 * width, which would both widen the measured line and let it break a word
 * earlier than the real heading does.
 */
function Words({ text }: { text: string }) {
  const words = text.split(' ')
  return (
    <>
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          {i > 0 && ' '}
          <span data-word className="inline-block">
            {word}
          </span>
        </Fragment>
      ))}
    </>
  )
}

/** The width of the widest line of `el`, as drawn. Lines are grouped the same
    way centreLines groups them — by where the browser actually put each word. */
function longestLine(el: HTMLElement | null): number {
  if (!el) return 0
  const lines = new Map<number, { left: number; right: number }>()
  for (const word of el.querySelectorAll<HTMLElement>('[data-word]')) {
    const r = word.getBoundingClientRect()
    const top = Math.round(r.top)
    const line = lines.get(top)
    if (line) {
      line.left = Math.min(line.left, r.left)
      line.right = Math.max(line.right, r.right)
    } else {
      lines.set(top, { left: r.left, right: r.right })
    }
  }
  let widest = 0
  for (const { left, right } of lines.values()) widest = Math.max(widest, right - left)
  return widest
}

/**
 * Centres each line of `el` by offsetting its words, and returns a function
 * that animates every one of those offsets back to zero.
 *
 * Lines are discovered rather than declared: the words have already been laid
 * out and wrapped by the browser, so grouping them by their offsetTop gives
 * exactly the lines on screen — whatever the language, width or font. That is
 * what lets the copy be centred without touching its wrap, and the wrap is what
 * the landing depends on.
 *
 * Returns a no-op if the element is missing, so a caller need not check.
 */
function centreLines(el: HTMLElement | null): (transition: string) => void {
  if (!el) return () => {}

  const words = [...el.querySelectorAll<HTMLElement>('[data-word]')]
  if (!words.length) return () => {}

  const box = el.getBoundingClientRect()
  const lines = new Map<number, HTMLElement[]>()
  for (const word of words) {
    // Rounded: sub-pixel differences within one line are common and would
    // otherwise split it into several.
    const top = Math.round(word.getBoundingClientRect().top)
    const line = lines.get(top)
    if (line) line.push(word)
    else lines.set(top, [word])
  }

  for (const line of lines.values()) {
    const first = line[0].getBoundingClientRect()
    const last = line[line.length - 1].getBoundingClientRect()
    // Half the slack, in the element's own units — the rects are read through
    // the parent's scale, so the offset has to be divided back out of it or the
    // lines are pushed too far.
    const scale = box.width / el.offsetWidth || 1
    const offset = (box.width - (last.right - first.left)) / 2 / scale
    for (const word of line) word.style.transform = `translateX(${offset}px)`
  }

  return (transition: string) => {
    for (const word of words) {
      word.style.transition = transition
      word.style.transform = 'translateX(0)'
    }
  }
}

/** Under test the curtain does not run at all — every visual baseline is a
    screenshot of the page behind it, and a timed animation over the top would
    make each run land on a different frame. */
export function HomeIntroCurtain() {
  if (E2E) return null
  return <IntroCurtain />
}
