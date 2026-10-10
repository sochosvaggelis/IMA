import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { E2E } from '@/lib/e2e'
import { clamp } from '@/lib/math'
import { markVesselReady } from '@/lib/vesselReady'
import { HeroSeaScene } from './HeroSeaScene'
import { SYSTEMS, type SystemSpec } from './systems'
import { MOBILE_LAYOUT_WIDTH } from './stage'

/**
 * Blueprint hero — the page around the 3D stage: the scroll runway and its
 * snapping, the intro panel, the system diagrams, the mobile feed and strip,
 * and the static fallback where there is no WebGL.
 *
 * The WebGL scene itself (the vessel, the sea, the camera sweep, and the notes
 * on how it is framed) is VesselCanvas.tsx. It is loaded separately, after the
 * first paint, so three.js never stands between a visitor and the page.
 */

const VesselCanvas = lazy(() => import('./VesselCanvas'))

/**
 * The mobile strip's two heights.
 *
 * It used to be one: a flat 45dvh, held for the entire 3,500px of scroll. That
 * is nearly half the screen given up on every one of four-and-a-bit screenfuls,
 * to a picture that changes only slowly — and the text was left reading through
 * a letterbox.
 *
 * So the strip now plays its two roles at two sizes. At the top of the page it
 * is the hero and takes the room a hero should. Once the reader has started
 * moving through the systems it becomes a reference — still pinned, still
 * tracking the section being read, but no longer the主 subject — and hands the
 * screen back to the content.
 *
 * These are the ends of a CONTINUOUS move, not two states — see the note on
 * stripHeightFor.
 */
const MOBILE_STRIP_OPEN_VH = 56
const MOBILE_STRIP_COLLAPSED_VH = 40

/**
 * ---------------------------------------------------------------------------
 * THE STRIP RESIZES; THE CANVAS INSIDE IT NEVER DOES. That separation is not a
 * detail — it is the whole reason this animates cleanly.
 *
 * Animating the canvas itself means R3F resizing the drawing buffer on every
 * frame of the transition, and the buffer necessarily lags the CSS box by a
 * frame: the last render gets stretched to a box it was not drawn for, so the
 * vessel visibly pulses the whole way down. Sixty resizes of a WebGL surface is
 * also real work for no gain.
 *
 * So the canvas is held at the OPEN height throughout and the strip is a
 * shrinking window onto it, clipping what it cannot show. The canvas is
 * simultaneously slid up by half of what the window loses, which keeps its
 * centre — and so the vessel — in the middle of whatever is still visible.
 * ---------------------------------------------------------------------------
 */
const MOBILE_STRIP_OPEN = `${MOBILE_STRIP_OPEN_VH}dvh`

/**
 * The strip's height for a given scroll past its own position in the page.
 *
 * ---------------------------------------------------------------------------
 * THE FEED PUSHES THE STRIP. The strip's bottom edge simply IS the top of the
 * first section, for as long as that edge is above the collapsed floor: scroll
 * a hundred pixels and the section rises a hundred pixels, closing the window
 * on the vessel by the same amount. The vessel is squeezed by the content
 * arriving under it, and only once it is down to its reference size does the
 * feed start sliding beneath it instead.
 *
 * It used to be a two-state toggle across a threshold with hysteresis, which
 * meant the strip stayed at its full height until the reader was already among
 * the sections and then jumped — the shrink had no author on screen.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS SAFE, WHERE THE TOGGLE NEEDED HYSTERESIS TO BE. The old version
 * changed the strip's LAYOUT height, which reflows the page — and the browser's
 * scroll anchoring answers a reflow by moving scrollY to hold the content
 * still. The trigger was measured from scrollY, so collapsing moved its own
 * input and the two heights could flap against each other indefinitely; the
 * thresholds had to sit more than a height-delta apart to break the loop.
 *
 * Nothing here changes layout at all. The strip keeps a constant OPEN-height
 * box in flow and only the WINDOW inside it is resized (see the strip markup),
 * so the feed's document position never moves, scrollY is never touched, and
 * `y` below is a pure input. That is also what makes the push read as one to
 * one: the section rises only by what the reader scrolled, never by the shrink
 * as well.
 * ---------------------------------------------------------------------------
 */
function stripHeightFor(y: number, viewportHeight: number): number {
  const open = (MOBILE_STRIP_OPEN_VH / 100) * viewportHeight
  const collapsed = (MOBILE_STRIP_COLLAPSED_VH / 100) * viewportHeight
  return clamp(open - y, collapsed, open)
}

/**
 * The right-hand column the intro and the diagrams share, so the eye stays put
 * when one hands over to the other. Desktop-only: the mobile explorer renders
 * the same content in normal flow instead of floating it over the scene.
 *
 * Width is driven by vw rather than a fixed rem so it holds its share of the
 * frame on a large display: a flat cap made the panel read as a postage stamp
 * at 2560px and wider. The lower bound keeps the diagrams legible just past the
 * lg breakpoint, the upper one stops an ultrawide from handing the panel more
 * width than the drawings can fill.
 */
const PANEL_COLUMN =
  'hidden fixed z-40 lg:block lg:top-1/2 lg:right-10 lg:w-[clamp(28rem,45vw,64rem)] lg:-translate-y-1/2'

/**
 * Snap stops: an opening frame, one per system, and a closing frame.
 *
 * The vessel layer is fixed and contributes no height, so these panels are
 * what create the scroll distance — one viewport each, with scroll-snap-align
 * on every one so the page always comes to rest on a stop and never between
 * two systems.
 *
 * ---------------------------------------------------------------------------
 * THE COUNT IS NOT ARBITRARY. With N stops the scrollable travel is (N-1)
 * viewports, so a stop at index i sits at progress i/(N-1). At N = 11 that
 * gives 0.0, 0.1, 0.2 … 1.0 — which is exactly where the nine systems are
 * placed (their `at` values run 0.1 … 0.9, see ./systems).
 *
 * Change the number of systems and this must change with it, or the snap
 * points drift off the systems and every stop lands slightly between two.
 * ---------------------------------------------------------------------------
 */
const SNAP_STOPS = SYSTEMS.length + 2

/** On-screen scroll readout for tuning the sweep. Flip to true while dialling
    the sweep in — it is a development aid and does not ship. */
const DEBUG_SCROLL = false

function SystemPanel({ spec }: { spec: SystemSpec }) {
  const { Diagram } = spec
  return (
    // max-h keeps the panel inside the viewport whatever its content: 5.5rem of
    // that budget is the fixed header (lg:h-22), which a vertically-centred
    // panel would otherwise slide under on a short screen. Raised with the bar.
    <div className="border-navy-800 bg-navy-950/90 max-h-[52dvh] overflow-y-auto rounded-lg border p-4 backdrop-blur-sm lg:max-h-[calc(100dvh-10rem)] lg:p-6">
      <p className="text-signal-500/80 font-mono text-[0.625rem] tracking-[0.2em]">
        {spec.index} / {String(SYSTEMS.length).padStart(2, '0')}
      </p>
      <h2 className="mt-1.5 text-base font-semibold text-white lg:text-lg">{spec.title}</h2>
      <div className="mt-3">
        <Diagram />
      </div>
      {/* The blurb is the first thing to go when space is tight — the diagram
          carries more meaning per pixel than the prose does. */}
      <p className="text-navy-300 mt-3 hidden text-xs leading-relaxed sm:block">{spec.blurb}</p>
    </div>
  )
}

/**
 * Where the reading line sits, as a fraction of the space BELOW THE STRIP. The
 * section spanning this line is the one being read, so it is the one the camera
 * shows and the one the feed highlights.
 *
 * ---------------------------------------------------------------------------
 * MEASURED FROM THE STRIP, NOT FROM THE VIEWPORT. It used to be 0.55 of the
 * viewport — a fixed y of about 464px on a phone — chosen when the strip was a
 * flat 45dvh. The strip now opens taller than that, so the line was landing
 * BEHIND the vessel: a section was marked active at the moment it disappeared
 * under the strip, which is the last moment it could be described as the one
 * being read.
 *
 * Deriving it from the strip's own bottom edge makes it correct at every strip
 * height by construction, including part-way through the collapse, and it can
 * never again drift behind the vessel however the strip is retuned.
 *
 * Kept in the upper part of that space: a section should light up as it comes
 * into the clear, not once it is halfway back out of view.
 * ---------------------------------------------------------------------------
 */
const FEED_FOCUS = 0.3

/**
 * The opening leg — amidships out to system 01 — measured in scroll past the
 * moment the strip pins, as a fraction of the viewport.
 *
 * ---------------------------------------------------------------------------
 * THIS EXISTS SO THE OPENING LEG COSTS NO LAYOUT. Progress is interpolated
 * between anchors, and the feed's opening anchor and system 01's anchor are the
 * first section's top edge — THE SAME PIXEL. Left alone, progress can only step
 * from 0 to 0.1 the instant the reading line touches the feed: the camera
 * teleports to system 01 and the opening frame is never seen.
 *
 * The obvious fix is a tall padding above the first section, giving the step
 * somewhere to happen. It works, and it costs exactly what it buys — a screenful
 * of empty navy between the vessel and the first heading. So the run-up is taken
 * in scroll instead: for this distance past the pin, progress is capped by a
 * ramp rather than by geometry, and the camera glides out to system 01 while the
 * page underneath stays gapless.
 *
 * 0.16vh is the strip's own collapse distance (MOBILE_STRIP_OPEN_VH less
 * MOBILE_STRIP_COLLAPSED_VH), which is the point: the camera's move out to the
 * first system and the vessel's settle into its reference size are the same
 * gesture, and end together.
 * ---------------------------------------------------------------------------
 */
const OPENING_TRAVEL = (MOBILE_STRIP_OPEN_VH - MOBILE_STRIP_COLLAPSED_VH) / 100

/**
 * How far BEFORE the strip pins the feed takes over, as a fraction of the
 * viewport.
 *
 * The pin is the earliest moment the reading line can be trusted (see the note
 * where this is used), but it is a hard edge, and handing over exactly on it
 * left the first heading sitting under the vessel for a beat looking inert
 * while the reader was plainly already reading it. Starting fractionally early
 * takes that beat out: system 01 lights, and the camera leaves the opening
 * frame, just before the vessel finishes settling into place.
 *
 * Keep this WELL under the strip's own height. It is a small anticipation, not
 * a second mechanism — pushed far enough back it would reintroduce exactly the
 * bug the pin gate exists to prevent, lighting the first heading while it is
 * still down at the bottom of the screen.
 */
const FEED_LEAD = 0.08

/**
 * The mobile home: a scrollytelling feed under the pinned vessel.
 *
 * The nine systems are ordinary text sections scrolling beneath the strip —
 * no snapping, no hijack, nothing hidden behind a tap. What keeps the
 * sweep alive is the mapping: a system HOLDS the camera for as long as its
 * section spans the reading line (two anchors per section, top and bottom,
 * both carrying its `at`), and the step between sections becomes a flight
 * because ProgressDriver eases everything written into the target. Holding
 * over the section's whole height — rather than anchoring its centre — is
 * what makes the flight start while the incoming heading is still on screen:
 * sections are taller than the reading area, and a centre anchor fired only
 * after the heading had scrolled under the strip. Start and end anchors at
 * the feed's edges hand the sweep its opening and closing views. Scroll and
 * the runway are just two authors of the same number.
 */
function MobileSystemsFeed({
  target,
  strip,
}: {
  target: { current: number }
  /** The vessel strip, so the reading line can be placed below it — see
      FEED_FOCUS. Its height changes as the page scrolls, so this is read live
      on every event rather than measured once. */
  strip: RefObject<HTMLDivElement | null>
}) {
  const feed = useRef<HTMLOListElement>(null)
  const sections = useRef<Array<HTMLLIElement | null>>([])

  /**
   * Which section the reading line is currently inside — the one being read,
   * and so the one to highlight.
   *
   * Derived HERE from the same geometry that drives the camera, rather than
   * from the eased progress the way it used to be. The two are equivalent once
   * a section has arrived — a section spanning the line holds progress at its
   * own `at` (that is what the two anchors per section are for), so "spans the
   * line" and "camera settled on this system" are the same instant by
   * construction. Where they differed was the APPROACH, and that difference is
   * the bug: the eased value passes a system's `at - HALF` (see systemActivity)
   * half a run-up early, so the heading lit while it was still down at the
   * bottom of the screen with nothing read. Keyed to the line, it lights when
   * it arrives and not before.
   */
  const [reading, setReading] = useState(-1)
  const readingRef = useRef(-1)

  /**
   * Document position at which the strip pins — the origin the opening leg is
   * measured from.
   *
   * Taken as scrollY + the strip's own rect.top and refreshed on every event
   * while it is still above the fold, which makes it exact no matter how
   * coarsely scroll events happen to be sampled during a fast fling. Reading it
   * off the scroll position alone would drift by however far a single event
   * jumped. Once pinned, rect.top is 0 for good and the held value is the
   * answer. (Same reasoning as stripFlowTop in the parent — see the note there
   * on why offsetTop cannot be used for this.)
   */
  const pinTop = useRef(0)

  useEffect(() => {
    const update = () => {
      const wrap = feed.current
      if (!wrap) return

      // Anchors are re-measured every event rather than cached: fonts and
      // diagram layout land after first paint and move every section.
      const rect = wrap.getBoundingClientRect()

      const anchors: Array<[number, number]> = [[rect.top, 0]]
      sections.current.forEach((el, i) => {
        if (!el) return
        const r = el.getBoundingClientRect()
        anchors.push([r.top, SYSTEMS[i].at], [r.bottom, SYSTEMS[i].at])
      })
      anchors.push([rect.bottom, 1])

      // Below whatever the strip currently covers, and always ON SCREEN.
      //
      // Both ends of the clamp are load-bearing. Past the feed the strip has
      // scrolled away and its bottom edge is negative, which would lift the
      // line above the window. Before the feed — at the top of the page, with
      // the intro card above it — the strip hangs BELOW the fold, and an
      // unclamped line landed off the bottom of the screen, far enough down the
      // feed to light up the first system while it was nowhere near being read.
      const vh = window.innerHeight
      const stripRect = strip.current?.getBoundingClientRect()
      const stripBottom = clamp(stripRect?.bottom ?? 0, 0, vh)
      const focus = stripBottom + (vh - stripBottom) * FEED_FOCUS

      /**
       * How far past the pin the reader is, and how much of the opening leg
       * that has bought. Below 1 the sweep has not left the opening frame.
       *
       * NOTHING MAY BE DRIVEN FROM THE READING LINE UNTIL THE STRIP IS PINNED.
       * The line is defined as a fraction of the space BELOW the strip, so while
       * the strip is still descending into place that space is the bottom sliver
       * of the screen and the line sits down there with it. The first section
       * crosses it while barely peeking into view — which is exactly the "lights
       * up far too early" this whole gate exists to stop. Held at zero until the
       * vessel is actually pinned, the geometry below only ever runs in the
       * configuration it was designed for.
       */
      if (stripRect && stripRect.top > 0) pinTop.current = window.scrollY + stripRect.top
      // FEED_LEAD brings the whole hand-over forward a little, so the highlight
      // and the camera's opening move both start just before the vessel has
      // finished settling rather than exactly on the pin.
      const past = window.scrollY - pinTop.current + FEED_LEAD * vh
      const opening = clamp(past / (OPENING_TRAVEL * vh), 0, 1)
      let p = anchors[anchors.length - 1][1]
      if (focus <= anchors[0][0]) {
        p = anchors[0][1]
      } else {
        for (let i = 0; i < anchors.length - 1; i++) {
          const [y0, p0] = anchors[i]
          const [y1, p1] = anchors[i + 1]
          if (focus <= y1) {
            p = y1 === y0 ? p1 : p0 + ((p1 - p0) * (focus - y0)) / (y1 - y0)
            break
          }
        }
      }
      // The opening leg, capped by the ramp rather than by the geometry: the
      // camera walks amidships → system 01 over OPENING_TRAVEL of scroll. Once
      // that is spent the cap is released entirely — capping with a plain
      // min() would peg the whole rest of the sweep at system 01.
      if (opening < 1) p = Math.min(p, SYSTEMS[0].at * opening)

      target.current = clamp(p, 0, 1)

      // The section the line is actually inside — and nothing at all until the
      // strip is pinned, per the note above. Past the last section it is -1
      // again, correctly: nothing is being read there.
      //
      // Gated on the pin rather than on the opening leg being fully spent.
      // Those are 128px apart, and with the feed gapless the line is ALREADY
      // inside the first section by the time the strip pins — so waiting for
      // the full leg handed section 01 a highlight window about sixteen pixels
      // wide before the line moved on to section 02, i.e. it never visibly lit
      // at all. The camera finishes its move a little after the heading lights,
      // which is the right way round: the vessel is still settling onto the
      // system you have just started reading.
      //
      // Guarded through a ref so this only reaches React when the answer
      // changes — nine times over the whole feed, not once per scroll event.
      let next = -1
      if (past >= 0) {
        for (let i = 0; i < sections.current.length; i++) {
          const el = sections.current[i]
          if (!el) continue
          const r = el.getBoundingClientRect()
          if (focus >= r.top && focus <= r.bottom) {
            next = i
            break
          }
        }
      }
      if (next !== readingRef.current) {
        readingRef.current = next
        setReading(next)
      }
    }

    update()
    window.addEventListener('scroll', update, { passive: true, capture: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, { capture: true })
      window.removeEventListener('resize', update)
    }
  }, [target, strip])

  return (
    // data-focus publishes the reading line for the layout test, which has to
    // place a section against it to assert the camera follows the reader.
    <div data-testid="systems-feed" data-focus={FEED_FOCUS}>
      {/* No lead-in padding here, deliberately — the opening leg is bought
          with SCROLL rather than with empty space. See OPENING_TRAVEL. */}
      <ol ref={feed} className="px-4 pb-10 sm:px-8">
        {SYSTEMS.map((spec, i) => {
          const current = reading === i
          return (
            <li
              key={spec.index}
              ref={(el) => {
                sections.current[i] = el
              }}
              data-testid="feed-section"
              data-active={current || undefined}
              className="border-navy-800/70 border-b py-8"
            >
              {/* The accent marks the section the reading line is inside — see
                  `reading` above. Which is also the moment the camera settles
                  on that system, so it still reads as the vessel answering the
                  reader; it just no longer answers several hundred pixels
                  early. */}
              <p
                className={`font-mono text-xs tracking-[0.2em] transition-colors ${
                  current ? 'text-signal-400' : 'text-signal-500/50'
                }`}
              >
                {spec.index} / {String(SYSTEMS.length).padStart(2, '0')}
              </p>
              <h2
                className={`mt-1.5 text-lg font-semibold transition-colors ${
                  current ? 'text-white' : 'text-navy-200'
                }`}
              >
                {spec.title}
              </h2>
              {/* No diagram here on purpose. The schematics are dense enough
                  that a phone shrinks them past reading, and the vessel above
                  is already carrying the visual with its labelled node. Text
                  is what the narrow column does well. */}
              <p className="text-navy-300 mt-3 text-sm leading-relaxed">{spec.blurb}</p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Longest to wait for the first-paint report: some loads never get one —
    a tab opened in the background, or a browser without paint timing. */
const FIRST_PAINT_FALLBACK_MS = 1000

/**
 * Runs `then` once the browser reports the page's first paint — straight
 * away if it already has (a visit that arrived by client-side navigation), or
 * after FIRST_PAINT_FALLBACK_MS if no report comes. Returns a cancel.
 */
function afterFirstPaint(then: () => void): () => void {
  let settled = false
  let observer: PerformanceObserver | undefined
  const stop = () => {
    settled = true
    clearTimeout(timer)
    observer?.disconnect()
  }
  const run = () => {
    if (settled) return
    stop()
    then()
  }
  const timer = window.setTimeout(run, FIRST_PAINT_FALLBACK_MS)
  try {
    observer = new PerformanceObserver((list) => {
      if (list.getEntriesByName('first-contentful-paint').length > 0) run()
    })
    observer.observe({ type: 'paint', buffered: true })
  } catch {
    // No paint timing at all: the fallback covers it.
  }
  return stop
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    )
  } catch {
    return false
  }
}

export function VesselScene({ label, intro }: { label: string; intro?: ReactNode }) {
  /** Where the scroll actually is — set by the scroll handler, in hard steps. */
  const scrollTarget = useRef(0)
  /** Where the scene is — eased toward the target by ProgressDriver. */
  const progress = useRef(0)
  const stops = useRef<HTMLDivElement>(null)
  /** The resizing WINDOW onto the scene — the visible strip. */
  const strip = useRef<HTMLDivElement>(null)
  /** The canvas's own box inside that window, held at the open height. */
  const canvasHolder = useRef<HTMLDivElement>(null)
  /** The strip's position in normal flow — see the note where it is read. */
  const stripFlowTop = useRef(0)
  const readout = useRef<HTMLDivElement>(null)
  const panelEl = useRef<HTMLDivElement>(null)
  const introEl = useRef<HTMLDivElement>(null)
  const labelEls = useRef<Array<HTMLDivElement | null>>([])

  // Which system's panel is mounted. This is the one thing here that DOES go
  // through React state — but it changes nine times across the whole scroll,
  // not per frame, so the re-render is free. Opacity is still written to the
  // DOM directly below, so the fade itself never re-renders anything.
  const [activeSystem, setActiveSystem] = useState(-1)
  const activeRef = useRef(-1)

  // Called every frame; only reaches React when the system actually changes.
  const handleSystemChange = useCallback((index: number) => {
    if (index === activeRef.current) return
    activeRef.current = index
    setActiveSystem(index)
  }, [])

  /**
   * Resolved after mount — touches APIs that only exist in a browser. null
   * until then, and THE NULL IS LOAD-BEARING: it is "not asked yet", which is
   * not the same as "no".
   *
   * It used to be a plain false, which meant the first paint of every visit —
   * including every machine that does have WebGL — rendered the no-WebGL
   * branch for one commit. That was harmless while the branch was only the
   * static scene. It stopped being harmless the moment the branch also
   * rendered `intro`, because the intro carries [data-hero-title], and the
   * intro curtain measures that heading in a useLayoutEffect and only keeps
   * looking while it is ABSENT (see MEASURE_DEADLINE_MS in IntroCurtain).
   *
   * So the curtain measured the heading in the fallback's full-width mobile
   * card rather than in the desktop panel it actually lands in — ~1408px
   * against ~648px. That pins the opening scale to its floor and leaves the
   * statement at the far left of the screen instead of centred on it.
   *
   * Undetermined therefore renders exactly what this branch rendered before:
   * the static scene, and no intro for the curtain to measure early.
   */
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const [still, setStill] = useState(E2E)
  /** Whether to mount the 3D scene — and so start downloading it. See below. */
  const [sceneWanted, setSceneWanted] = useState(false)

  // Which home presentation is live: the desktop scroll sweep or the mobile
  // feed. React state rather than CSS hiding, because the two render the
  // SAME content (the intro with its h1, the system diagrams) and only one
  // copy may exist in the DOM at a time. Both layouts re-derive the progress
  // target from scroll immediately on mount, so no reset is needed when the
  // window crosses the boundary.
  const [mobileLayout, setMobileLayout] = useState(
    () => window.innerWidth < MOBILE_LAYOUT_WIDTH,
  )
  useEffect(() => {
    const desktop = window.matchMedia(`(min-width: ${MOBILE_LAYOUT_WIDTH}px)`)
    const sync = () => setMobileLayout(!desktop.matches)
    desktop.addEventListener('change', sync)
    return () => desktop.removeEventListener('change', sync)
  }, [])

  // The strip giving the screen back to the content, a pixel at a time as the
  // feed pushes up into it — see stripHeightFor. Written straight to the DOM
  // rather than held in state: this now changes on every scroll event, and a
  // React render per event to set one height would be absurd.
  useEffect(() => {
    if (!mobileLayout) return
    const update = () => {
      /**
       * Measured from the strip's own place in the page, not from the top of
       * the document. The intro card sits above it, so raw scrollY would have
       * the vessel collapsing while it was still below the fold — shrunk before
       * it had been seen at all.
       *
       * NOT offsetTop, which is the obvious way and is wrong here: on a sticky
       * element it reports where the element currently IS, so once stuck it
       * tracks scrollY exactly and `scrollY - offsetTop` sits at zero forever.
       * The strip simply never collapsed.
       *
       * The flow position is instead taken from the rect while the strip is
       * still above the fold, and held once it sticks. That also keeps it right
       * across reflows of the card above — webfonts, a language switch — since
       * it is refreshed on every event until the moment it pins.
       */
      const rect = strip.current?.getBoundingClientRect()
      if (rect && rect.top > 0) stripFlowTop.current = rect.top + window.scrollY
      const y = window.scrollY - stripFlowTop.current

      const vh = window.innerHeight
      const height = stripHeightFor(y, vh)

      // The window closes; the canvas inside it keeps its open height and is
      // slid up by half of what the window lost, so the vessel stays centred in
      // what is still visible. See the note above MOBILE_STRIP_OPEN.
      if (strip.current) strip.current.style.height = `${height}px`
      if (canvasHolder.current) {
        canvasHolder.current.style.top = `${-((MOBILE_STRIP_OPEN_VH / 100) * vh - height) / 2}px`
      }
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [mobileLayout])

  // Snapping is applied to the document element here rather than in index.css
  // so it belongs to this scene: the rest of the site scrolls normally, and
  // the setting is torn down when the hero unmounts on navigation.
  //
  // Desktop-only, tracked live: the mobile explorer scrolls a normal page, and
  // mandatory snapping with no runway on screen would glue it to the top.
  useEffect(() => {
    const root = document.documentElement
    const previous = root.style.scrollSnapType
    const desktop = window.matchMedia(`(min-width: ${MOBILE_LAYOUT_WIDTH}px)`)
    const sync = () => {
      root.style.scrollSnapType = desktop.matches ? 'y mandatory' : previous
    }
    sync()
    desktop.addEventListener('change', sync)
    return () => {
      desktop.removeEventListener('change', sync)
      root.style.scrollSnapType = previous
    }
  }, [])

  /**
   * Height of the footer, used to lift it into the closing frame.
   *
   * Measured rather than assumed: the footer rewraps at every breakpoint, and a
   * hardcoded figure would leave a gap on one viewport and clip it on another.
   * Observed, not read once, because the webfonts land after first paint and
   * reflow it.
   */
  const [footerHeight, setFooterHeight] = useState(0)
  useEffect(() => {
    const footer = document.querySelector('footer')
    if (!footer) return
    const observer = new ResizeObserver(() => setFooterHeight(footer.offsetHeight))
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const webglOk = hasWebGL()
    setWebgl(webglOk)

    // The 3D code and the model download start here — once a frame is on
    // screen, and only where there is a WebGL context to draw them — rather
    // than at module load, where they used to be. There they began before the
    // intro curtain had painted: the code, as a static import, held up the
    // first paint itself, and the model's 625 KB competed on a slow connection
    // with the fonts the curtain needed. Both were also fetched on machines
    // that then fell back to the static scene and never used them. The curtain
    // is on screen for the whole download either way.
    //
    // After the browser REPORTS the paint, not just after this effect: an
    // effect can run before anything is on screen, and a download started
    // then is one Lighthouse counts against the first paint — it charged the
    // whole 3D load to the curtain's text. Even a frame later is too soon:
    // the paint reaches the screen a little after the frame is drawn.
    const cancelScene = webglOk ? afterFirstPaint(() => setSceneWanted(true)) : () => {}

    // markVesselReady() otherwise only fires from inside the 3D Vessel
    // component, which never mounts here — so without this, the intro
    // curtain (see IntroCurtain.tsx) would never hear that anything is ready
    // and would sit through its full MAX_WAIT_MS fallback (6s) before
    // opening, on every single load. That wait exists to cover the GLB load
    // and edge extraction; the fallback scene has nothing of the kind to wait
    // for, so there is nothing to gain by holding the curtain for it.
    if (!webglOk) markVesselReady()

    // Seakeeping is unprompted motion, so it honours the OS setting. The
    // scroll sweep is not affected — that one the user is driving themselves.
    // The test flag rides the same switch: it already means "hold the rest
    // pose", which is exactly the deterministic frame screenshots need.
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = () => setStill(E2E || motion.matches)
    syncMotion()
    motion.addEventListener('change', syncMotion)

    // Mapped over the whole document rather than one element: the vessel is
    // on screen for the entire page, so the sweep should be too.
    const update = () => {
      const el = stops.current
      if (!el) return

      // Measured from the snap panels themselves, NOT from the document.
      //
      // document.scrollHeight includes the header and footer as well as these
      // panels, so dividing by it stretched the mapping: every stop landed a
      // little further off than the last, and by the fifth system the camera
      // was nowhere near the node being labelled.
      //
      // Reading the container's own rect makes the two agree by construction.
      // A panel snapped to the top of the viewport puts the container top at
      // exactly -(i * panelHeight), so stop i is exactly i/(stops-1) — whatever
      // else the page has above or below it.
      const panelHeight = el.offsetHeight / SNAP_STOPS
      const travel = panelHeight * (SNAP_STOPS - 1)
      const scrolled = -el.getBoundingClientRect().top

      // On the mobile feed the runway is display:none, so travel measures
      // zero. Returning — rather than writing 0 — is what hands the target to
      // the feed's own scroll mapping: both handlers fire on every scroll,
      // and writing 0 here would yank the camera home each time.
      if (travel <= 0) return

      // Only the TARGET is written here. ProgressDriver eases the scene toward
      // it each frame, so a hard snap correction becomes a glide instead of a
      // jump. Everything downstream reads the eased value, never this one.
      scrollTarget.current = clamp(scrolled / travel, 0, 1)
    }

    update()
    // capture: true so a scroll on any inner element reaches this too —
    // scroll events do not bubble, but they do run the capture phase.
    window.addEventListener('scroll', update, { passive: true, capture: true })
    window.addEventListener('resize', update)
    return () => {
      cancelScene()
      motion.removeEventListener('change', syncMotion)
      window.removeEventListener('scroll', update, { capture: true })
      window.removeEventListener('resize', update)
    }
  }, [])

  /**
   * WITHOUT WEBGL THERE IS NO SWEEP TO FALL BACK TO — so this is not a
   * smaller version of the render below, it is a genuinely different page:
   * the static SVG scene, stacked over the same intro and systems content the
   * mobile feed uses, in normal document flow. No `<Canvas>`, no camera, no
   * ProgressDriver — none of those exist without a WebGL context to draw
   * into, so nothing here may depend on them.
   *
   * THIS BRANCH USED TO BE `return <HeroSeaScene label={label} />` AND
   * NOTHING ELSE, which was a dead end: with SHOW_PAGE_CONTENT parking the
   * rest of the page's copy, that left a single static screen and a footer —
   * a document exactly one viewport tall, so scrolling had nowhere to go.
   * That is invisible in day-to-day dev (a real GPU is almost always
   * available) and correspondingly easy to ship by accident: it only shows up
   * on a machine where `hasWebGL()` genuinely comes back false — a locked-down
   * corporate browser with hardware acceleration disabled by policy, or a
   * remote-desktop / VDI session with no GPU passthrough, are the common real
   * cases. Reusing MobileSystemsFeed here means every device gets the actual
   * nine-system write-up to scroll through, WebGL or not.
   */
  // Not asked yet: the static scene ALONE, and in particular no `intro`. See
  // the note on the webgl state — rendering the heading here, one commit
  // before the real layout exists, is what the curtain would measure against.
  //
  // Held at a full screen's height. The scene sizes itself to its container,
  // and with no height here it collapsed to its content — shorter than the
  // viewport, so for this one commit the footer sat on screen, then was shoved
  // far down when the real layout replaced it. On a slow phone that commit
  // paints, and Lighthouse scored the jump as a 1.8 layout shift (0.1 is the
  // limit for "good"). The intro curtain covers the page throughout, so
  // nobody sees this frame either way.
  if (webgl === null) {
    return (
      <div className="h-dvh">
        <HeroSeaScene label={label} />
      </div>
    )
  }

  if (!webgl) {
    return (
      <>
        {intro && <div className="px-4 pt-36 sm:px-8">{intro}</div>}
        <div
          ref={strip}
          className="border-navy-800 sticky top-0 z-10 overflow-hidden border-b"
          style={{ height: MOBILE_STRIP_OPEN }}
        >
          <HeroSeaScene label={label} />
        </div>
        <MobileSystemsFeed target={scrollTarget} strip={strip} />
      </>
    )
  }

  return (
    <>
      {/* The intro card, ABOVE the vessel on mobile: the statement and the two
          calls to action come first, and the vessel is what you scroll into.
          (On desktop the intro is a fixed panel beside the scene instead — see
          further down.) */}
      {/* pt clears the fixed header, which floats over the top of the page.
          It used to be the strip that started here, and a header lying over a
          canvas costs nothing; a card is the first thing now, and at pt-6 its
          eyebrow was hidden behind the nav. */}
      {mobileLayout && intro && <div className="px-4 pt-36 sm:px-8">{intro}</div>}

      {/* Two lives, one canvas.

          Desktop: fixed and full-viewport, so the vessel never leaves the
          screen during the sweep. `-z-10` is deliberate: a fixed element at
          z-0 creates a stacking context and would paint OVER the page's static
          content, while a negative index still paints above the body
          background.

          Mobile: a sticky strip at the top of a normally-scrolling page — the
          stage the scrolling feed flies the camera around in. `z-10` here for
          the opposite reason the desktop is negative: the canvas clears
          opaque navy, and the feed is MEANT to slide away beneath it. One
          element rather than two branches because a second Canvas would be a
          second WebGL context and a second copy of the model. */}
      {/* The strip's PLACE in the page, and on mobile the one thing here that
          never changes size. Holding the flow box at the open height while only
          the window inside it shrinks is what keeps the feed's document
          position fixed — so the sections rise at exactly the rate the reader
          scrolls, and the resize can never move scrollY under them. See
          stripHeightFor.
          pointer-events are off on this box: past the window it is empty space
          lying over the feed, and it must not swallow taps meant for it. */}
      <div
        className="pointer-events-none sticky top-0 z-10 lg:fixed lg:inset-0 lg:-z-10 lg:h-auto"
        style={mobileLayout ? { height: MOBILE_STRIP_OPEN } : undefined}
      >
        <div
          ref={strip}
          // pointer-events back ON for the window itself: content scrolled
          // under the opaque strip is still in the hit-test tree, and a
          // see-through strip would forward taps to links the user cannot see.
          // The window swallows them. Desktop leaves interaction off — the
          // layer is fixed under the whole page and must never intercept
          // clicks meant for the content.
          className="border-navy-800 pointer-events-auto relative overflow-hidden border-b lg:pointer-events-none lg:h-full lg:overflow-visible lg:border-b-0"
          // Height is inline and mobile-only, and is rewritten on every scroll
          // by the effect above; this is just its opening value. The desktop
          // layer takes its size from the fixed parent and must never be given
          // one of these. overflow-hidden is what makes this a WINDOW onto the
          // canvas rather than a box that resizes it — see MOBILE_STRIP_OPEN_VH.
          style={mobileLayout ? { height: MOBILE_STRIP_OPEN } : undefined}
          role="img"
          aria-label={label}
        >
        {/* The canvas holder. Fixed at the open height for the whole life of
            the page, and slid up by half of what the window loses so the
            vessel stays centred in what remains visible. Nothing here changes
            the canvas's SIZE, which is the point. */}
        <div
          ref={canvasHolder}
          style={
            mobileLayout
              ? {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: MOBILE_STRIP_OPEN,
                  top: 0,
                }
              : { position: 'relative', height: '100%' }
          }
        >
        {/* The WebGL scene, in its own chunk (see VesselCanvas.tsx). Nothing
            in its place while it loads: the curtain covers this either way. */}
        {sceneWanted && (
          <Suspense fallback={null}>
            <VesselCanvas
              still={still}
              target={scrollTarget}
              progress={progress}
              panelEl={panelEl}
              introEl={introEl}
              readoutEl={readout}
              onSystemChange={handleSystemChange}
              labels={labelEls}
            />
          </Suspense>
        )}

        {/* The labels live INSIDE the canvas holder, and that is the whole
            trick: each one's position is written every frame in CANVAS pixels,
            so putting them in the canvas's own box makes the two agree by
            construction — at any strip height, mid-collapse, and wherever the
            strip happens to sit on screen.

            They used to be a viewport-fixed layer that mirrored the strip's
            height and the canvas's offset. That held only while the strip was
            the first thing on the page and so always at the top. With the intro
            card above it, the strip sits hundreds of pixels down until it
            sticks — and the labels went on drawing at the top of the window,
            stranded over the card.

            The strip clips them too (overflow-hidden), so a marker on the part
            of the hull the collapsed strip cannot show does not put its chip
            out over the article text. */}
        <div className="pointer-events-none absolute inset-0 z-40" aria-hidden="true">
          {SYSTEMS.map((spec, i) => (
            <div
              key={spec.index}
              ref={(el) => {
                labelEls.current[i] = el
              }}
              className="absolute top-0 left-0 opacity-0"
              style={{ willChange: 'transform' }}
            >
              {/* Only the vertical centring lives here — the offset from the
                  node is written each frame, since which side of it the chip
                  takes depends on the room left in the canvas. */}
              <div className="border-alert-500/60 bg-navy-950/90 text-alert-500 -translate-y-1/2 rounded border px-2 py-1 font-mono text-[0.625rem] tracking-[0.14em] whitespace-nowrap uppercase">
                {spec.title}
              </div>
            </div>
          ))}
        </div>
        </div>
        </div>
      </div>

      {/* In flow directly under the sticky strip: the systems scroll beneath
          the pinned vessel, driving the camera as they go. */}
      {mobileLayout && (
        <MobileSystemsFeed target={scrollTarget} strip={strip} />
      )}

      {/* Company intro, holding the first stop before any system appears.
          Sits in the same right-hand column the diagrams use, so the eye does
          not have to move when the first system takes over from it. */}
      {!mobileLayout && intro && (
        <div
          ref={introEl}
          data-testid="hero-intro"
          className={PANEL_COLUMN}
        >
          {intro}
        </div>
      )}

      {/* The diagram carries the technical content the model cannot. */}
      {!mobileLayout && (
        <div
          ref={panelEl}
          data-testid="system-panel"
          className={`pointer-events-none opacity-0 ${PANEL_COLUMN}`}
          aria-hidden="true"
        >
          {activeSystem >= 0 && <SystemPanel spec={SYSTEMS[activeSystem]} />}
        </div>
      )}

      {/* Sits outside the vessel layer: that one is at -z-10 and would put the
          readout behind the page background. */}
      {/* Hidden under test even while the debug aid ships: it will be removed
          before launch, and baselines with it burned in would all break then. */}
      {DEBUG_SCROLL && !E2E && (
        <div
          ref={readout}
          className="bg-navy-950/90 text-signal-400 border-navy-800 pointer-events-none fixed bottom-3 left-3 z-50 rounded border px-2 py-1 font-mono text-[11px] leading-relaxed whitespace-pre tabular-nums"
        >
          0.0%
        </div>
      )}

      {/* One viewport-tall panel per stop, each a snap target. `h-screen`
          rather than `h-dvh` on purpose: dvh changes as mobile browser
          toolbars collapse, which would resize every panel mid-scroll and move
          the snap points under the user's finger.
          The wrapper is measured every frame to derive progress — see update(). */}
      {/* data-scroll-stops is the tests' handle on the runway: they scroll to
          container top + i × viewport to land exactly on stop i. */}
      {/* The negative bottom margin lifts the footer into the lower part of the
          closing frame, so arriving at 100% arrives at the footer instead of
          leaving one more empty scroll to find it.

          A margin is what makes this safe. Progress is derived from this
          container's offsetHeight and its rect top (see update()), and a margin
          changes neither — so every snap point stays exactly on its system. The
          stops themselves must never be resized to achieve this: offsetHeight
          is divided by SNAP_STOPS on the assumption they are uniform.

          It also squares the document off: the footer no longer adds height
          past the runway, so maximum scroll now coincides with the last stop. */}
      {/* Desktop-only: the feed page creates its own scroll height and drives
          progress from its sections. display:none collapses offsetHeight to
          zero, which is exactly the signal update() reads to leave the
          feed-owned target alone. */}
      <div
        ref={stops}
        data-scroll-stops
        aria-hidden="true"
        className="hidden lg:block"
        style={{ marginBottom: -footerHeight }}
      >
        {Array.from({ length: SNAP_STOPS }, (_, i) => (
          <div key={i} className="h-screen" style={{ scrollSnapAlign: 'start' }} />
        ))}
      </div>

      {/* A resting place for the document tail.

          `y mandatory` means the scroller must always come to rest ON a snap
          target. With the footer lifted above, the last stop normally IS the
          document bottom and this is redundant — but it stops the page springing
          back to stop 10 in the one case where that stops being true: a footer
          taller than the closing frame, which pushes maximum scroll past the
          last stop again and would strand the overflow below the fold. */}
      <div aria-hidden="true" style={{ scrollSnapAlign: 'start' }} />
    </>
  )
}
