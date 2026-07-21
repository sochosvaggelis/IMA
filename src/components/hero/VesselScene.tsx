import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { E2E } from '@/lib/e2e'
import { markVesselReady } from '@/lib/vesselReady'
import { HeroSeaScene } from './HeroSeaScene'
import {
  SYSTEMS,
  dominantSystem,
  focusTarget,
  introActivity,
  systemActivity,
  type SystemSpec,
} from './systems'

/**
 * Blueprint hero — scroll stage.
 *
 * The vessel is drawn in linework (sharp structural creases over an opaque
 * fill) and held on the left of the frame while the camera sweeps through the
 * three views a general arrangement is actually drawn in, driven by scroll:
 *
 *     three-quarter astern  ->  profile (beam-on)  ->  three-quarter ahead
 *
 * One continuous arc around the vessel, staying low near the waterline the
 * whole way rather than rising over it. The closing stop mirrors the opening
 * across the beam, so the sweep reads as a single circling move.
 *
 * Underneath those three stops the look-at tracks the SYSTEM being annotated
 * (see focusTarget in ./systems): it starts amidships, then walks anchor to
 * anchor through the nine systems, settling on each one exactly where that
 * system's marker and diagram are fully shown. The orbit gives the movement,
 * the systems decide where it points.
 *
 * Two independent motions are in play, and they are deliberately separate:
 * the CAMERA is driven by scroll position, while the VESSEL is always under
 * way on its own clock (see MOTION). Scroll can be still and the ship is not.
 *
 * The sea is a drifting survey grid (see the Waterplane note), which gives the
 * vessel both headway and a fixed reference to move against — the seakeeping
 * is close to unreadable without something stationary in frame.
 *
 * ---------------------------------------------------------------------------
 * Three decisions here are worth not undoing by accident:
 *
 *   - THE ARC IS SPLIT INTO TWO EASED HALVES, NOT ONE SWEEP. Interpolating
 *     straight from the opening angle to the closing one would pass through
 *     beam-on at full speed, and the profile would never register as a stop.
 *     Easing each half separately makes the camera settle there.
 *
 *   - EACH MOVE EASES WITH smoothstep, WHICH IS WHAT MAKES THE JOIN INVISIBLE.
 *     smoothstep arrives and leaves with zero gradient, so the swing has
 *     stopped dead at p = 0.5 exactly as the climb begins. Linear ramps would
 *     put a visible corner there.
 *
 *   - THE ORBIT RADIUS IS SOLVED ONCE, NOT RE-FITTED PER FRAME. Distance comes
 *     from the opening view and is then held, so the vessel genuinely grows as
 *     it turns broadside and shows its length — re-fitting each frame would
 *     hold it at a constant size and silently cancel that out.
 *     The one deliberate exception is PROFILE_DISTANCE_SCALE, a push-in that
 *     peaks at the beam-on stop and returns to the standing distance by both
 *     ends of the sweep.
 *
 *   - THE VESSEL IS PUSHED LEFT WITH A FRUSTUM SHIFT, NOT BY AIMING THE
 *     CAMERA. Offsetting the lookAt target would yaw the camera by ~12deg at
 *     this framing, tilting the hull's axis on screen and visibly skewing the
 *     plan view. setViewOffset slides the projection sideways instead: the
 *     ship moves left with its centreline still exactly horizontal.
 *
 * Edge extraction is memoised on the geometry — EdgesGeometry walks all ~200k
 * triangles and hashes every edge, which is a few hundred milliseconds. It
 * must never end up in the frame loop.
 * ---------------------------------------------------------------------------
 */

/* Model space: X is fore/aft (length 100), Y is up (origin at the keel), Z is
   the beam. Roughly to scale — 5.7:1 length-to-beam against a real 5.9:1. */
const MODEL_URL = `${import.meta.env.BASE_URL}models/vessel.glb`
const DRACO_PATH = `${import.meta.env.BASE_URL}draco/`

const SHIP_LENGTH = 100
const SHIP_BEAM = 17.5

/** Degrees between adjoining face normals below which an edge is ignored.
    A hull is mostly smooth curvature; below ~30 this returns a mat of
    triangle edges instead of a drawing. */
const EDGE_ANGLE = 32

/** Camera elevation at each stop. All low: the sweep stays down near the
    waterline throughout, circling the vessel rather than rising over it. */
const ELEVATION_BOW = 10
const ELEVATION_SIDE = 3
/** A touch above the waterline astern, so the stern view reads as a view of a
    ship rather than a flat silhouette. */
const ELEVATION_STERN = 6

/** Azimuth around the vessel. 0 is beam-on (the profile); -90 would be dead
    astern, looking straight up the centreline.
    The opening stop is deliberately held off that centreline: a true dead-
    astern view is square-on and reads flat, with the hull hidden behind its
    own transom. Backing off to -75 turns the vessel a little and opens up one
    flank, so the first thing on screen has depth to it. Push toward -90 for
    squarer, toward 0 for more of a three-quarter; go past -90 (e.g. -105) to
    open the opposite flank instead.
    NOTE: if this opening view shows the BOW rather than the stern, the model's
    fore/aft sign is opposite to what is assumed here — mirror to +75. */
const AZIMUTH_SIDE = 0
const AZIMUTH_STERN = -75

/** The closing stop, mirroring the opening across the beam: the same
    three-quarter angle, taken from ahead instead of astern. Derived from
    AZIMUTH_STERN so the arc stays symmetric if that is retuned. */
const AZIMUTH_BOW = -AZIMUTH_STERN

const FOV = 30

/** Share of frame width the vessel spans IN THE OPENING VIEW. Solved for once
    against aspect, so the first shot frames identically on a phone and an
    ultrawide. Later views are not re-fitted — see the fixed-radius note. */
const SHIP_FRACTION = 0.44

/** What the vessel presents at the opening azimuth — mostly beam, plus the
    foreshortened length showing at 15deg off the centreline. The whole sweep
    is framed on this one number, which is what keeps the radius fixed. */
const FRAMING_EXTENT =
  Math.abs(SHIP_LENGTH * Math.cos((AZIMUTH_STERN * Math.PI) / 180)) +
  Math.abs(SHIP_BEAM * Math.sin((AZIMUTH_STERN * Math.PI) / 180))

/** Floor on the solved distance, and in practice the value actually in force:
    the opening view presents only ~43 units of vessel, which would fit at ~102
    and put the camera close to a hull whose half-length is 50. Since the
    radius is now fixed for the whole sweep, THIS is the master zoom control —
    raise it to pull the camera out of every view at once. */
const MIN_DISTANCE = 110

/**
 * How much closer the camera comes at the beam-on profile, as a fraction of
 * the standing distance. 1 keeps the old fixed radius; lower pushes in.
 *
 * Applied through sin(PI * p), which is 0 at both ends of the scroll and 1
 * exactly at p = 0.5 — so the push-in peaks precisely at the profile stop and
 * returns to the standing distance at the two three-quarter views, with no
 * keyframes to line up and no seam at either end.
 */
const PROFILE_DISTANCE_SCALE = 0.8

/**
 * Camera standing distance for a viewport aspect — the master framing solve,
 * shared by the rig and the fog so the two can never disagree about where the
 * vessel stands.
 *
 * The aspect is clamped to 1: on a portrait phone the width is the scarce
 * dimension, and solving the 44% fraction against it pushed the camera to
 * ~395 units — beyond FOG_FAR, which is why the vessel used to render as a
 * barely-there ghost on mobile. Clamping makes portrait fit against height
 * instead, so the hull spans most of the narrow frame and the camera stays
 * near the visible range.
 */
function standingDistance(aspect: number, fraction: number = SHIP_FRACTION): number {
  const fit =
    FRAMING_EXTENT /
    (2 * fraction) /
    (Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * Math.max(aspect, 1))
  return Math.max(fit, MIN_DISTANCE)
}

/* Longitudinal travel used to be a fixed choreography here (amidships → stern
   → bow). It is now derived from the systems themselves — see focusTarget in
   ./systems, which walks the camera from anchor to anchor so it settles on
   whichever system is currently annotated. */

/** Fraction of viewport width the image is panned right, which moves the
    vessel that much left. 0.22 puts its centre at ~28% from the left edge. */
const LEFT_SHIFT = 0.22

/** Same trick on the vertical axis: panning the projection down lifts the
    vessel up the frame. Raise to lift further, negative to drop it. */
const UP_SHIFT = 0.08

/** Where the mobile feed layout takes over. The same 1024px the CSS lg:
    breakpoint uses, so the camera's idea of the layout always matches the one
    on screen. Below it the canvas is a sticky strip at the top of the page and
    the systems scroll beneath it as a normal feed, not a snap runway. */
const MOBILE_LAYOUT_WIDTH = 1024

/** Ship fraction for the mobile strip. The strip is the vessel's whole stage —
    there is no side column to clear — so the hull earns a far larger share of
    the frame than the desktop's 44%. */
const MOBILE_SHIP_FRACTION = 0.72

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
 * Height of the fixed header, in px, which floats OVER the top of the strip
 * rather than sitting above it.
 *
 * The camera centres the vessel in the canvas, and the canvas is the whole
 * strip — including the band the header covers. At 60dvh that band is a tenth
 * of the frame and no one notices; collapsed it is a fifth, and the hull sits
 * behind the nav. The rig subtracts half of this from its vertical framing so
 * the vessel is centred in the part of the strip that can actually be seen.
 *
 * MUST MATCH THE BAR'S OWN HEIGHT below lg — h-20 in Header.tsx. It is a number
 * here because the camera solve needs one, which makes it the one copy that can
 * silently fall out of step: too small and the vessel drifts back under the nav,
 * too large and it sits low in the strip.
 */
const MOBILE_HEADER_PX = 80

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
  return THREE.MathUtils.clamp(open - y, collapsed, open)
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

/**
 * How fast the scene catches up to the scroll position, per second.
 *
 * Mandatory snapping moves the scroll position in hard steps — a wheel notch
 * that lands mid-panel gets corrected in one jump, and following that raw
 * value made the camera lurch. The scene therefore chases the scroll position
 * rather than tracking it exactly: it is always heading for the right place
 * and arrives a fraction of a second later, which turns the correction into a
 * glide without changing where anything ends up.
 *
 * Higher is tighter and closer to the raw scroll; lower is floatier. At 6 the
 * scene covers ~95% of a snap correction in half a second.
 */
const SCROLL_DAMPING = 6

/** On-screen scroll readout for tuning the sweep. Flip to true while dialling
    the sweep in — it is a development aid and does not ship. */
const DEBUG_SCROLL = false

/**
 * Seakeeping. Amplitudes are small and periods are long on purpose — a laden
 * bulk carrier is 190m of steel with enormous rotational inertia, so it rolls
 * on the order of 13 seconds, not 2. Fast or wide motion instantly reads as a
 * dinghy; this should look like something heavy in a moderate swell.
 *
 * The periods are mutually non-commensurate (13 / 8.5 / 9.7 / 19), so the four
 * motions never re-align into a pattern the eye can catch. A shared period,
 * or periods in simple ratios, would visibly loop within a few seconds. The
 * phase offsets stop them all crossing zero on the same frame, which is what
 * makes it look mechanical rather than alive.
 *
 * Model space: roll is about X (fore/aft), pitch about Z (the beam), yaw about
 * Y (up).
 */
const MOTION = {
  rollDeg: 1.6,
  rollPeriod: 13,
  pitchDeg: 0.7,
  pitchPeriod: 8.5,
  heave: 0.7,
  heavePeriod: 9.7,
  yawDeg: 0.45,
  yawPeriod: 19,
} as const

const TAU = Math.PI * 2

/**
 * Sea — a survey lattice displaced into a swell.
 *
 * Cells are 10 units, so the hull measures a readable 10 squares end to end
 * and the sea doubles as a scale reference rather than just texture. It is
 * built as an explicit line lattice rather than a wireframe mesh: wireframe
 * would draw every triangle's diagonal too, giving triangles instead of the
 * squares this is supposed to read as.
 *
 * Height is the sum of four travelling sine components. Superposing waves of
 * different wavelength, direction and speed is what stops it reading as
 * corrugated iron — a single sine looks like a machined surface, and the
 * cross-swell component (one running across the beam) is what makes it look
 * like open water rather than a ripple tank.
 *
 * ---------------------------------------------------------------------------
 * THE X WAVELENGTHS ARE NOT ARBITRARY: 120, 60 and 40 all divide DRIFT_WRAP.
 * The lattice slides astern for headway and wraps on a modulo, and that wrap
 * is only invisible if the surface is exactly periodic over the wrap distance.
 * Pick an x-wavelength that doesn't divide 120 and the whole sea visibly jumps
 * every time it wraps. Waves running purely across the beam (lengthX: 0) are
 * unaffected and can take any wavelength.
 *
 * Time evolution is safe across the wrap: the shift is one whole spatial
 * period, so the surface before and after is identical at the same instant.
 * ---------------------------------------------------------------------------
 */
const GRID_EXTENT = 600
const GRID_DIVISIONS = 90
const GRID_Y = -9
/** Units per second the sea slides astern. */
const SEA_DRIFT = 2.4
/** Distance the drift wraps on. Must be a multiple of the cell size, and every
    wave's lengthX must divide it. */
const DRIFT_WRAP = 120

/**
 * Elliptical fade, so the sea exists only around the vessel and dissolves into
 * the background instead of tiling out to the frame edge.
 *
 * An ellipse rather than a circle because the vessel is ~5.7:1 — a circular
 * patch big enough to clear the bow is far wider than it needs to be abeam,
 * and one sized to the beam clips the ends off.
 *
 * The two radii are used to NORMALISE the distance, so r = 1 is the edge of
 * the ellipse in every direction and the softness below is a single fraction
 * of that, rather than two separate distances to keep in sync.
 *
 * Measured from the vessel in WORLD space, not from the lattice — the lattice
 * slides astern, and baking the fade into it would drag the clear patch along
 * with the drift instead of leaving it centred on the ship.
 *
 * CONSTRAINT: GRID_EXTENT / 2 - DRIFT_WRAP must stay >= SEA_FADE_X, or the
 * lattice's own edge drifts inside the visible area and shows as a hard
 * straight line. That ceiling is 180 at present. SEA_FADE_Z has no drift to
 * contend with, so its only limit is GRID_EXTENT / 2.
 */
/** Reach ahead and astern — the long axis, running with the hull. */
const SEA_FADE_X = 120
/** Reach abeam — the short axis. */
const SEA_FADE_Z = 55
/** Where the fade begins, as a fraction of the way out to the edge. Lower is
    a softer, more gradual dissolve; near 1 gives a hard-edged pool. */
const SEA_FADE_SOFTNESS = 0.18

const SEA_WAVES = [
  { lengthX: 120, lengthZ: 0, amplitude: 0.85, speed: 0.35, phase: 0 },
  { lengthX: 60, lengthZ: 80, amplitude: 0.45, speed: 0.55, phase: 1.7 },
  { lengthX: 40, lengthZ: 0, amplitude: 0.25, speed: 0.9, phase: 3.1 },
  // Cross-swell, running across the beam rather than with the ship.
  { lengthX: 0, lengthZ: 70, amplitude: 0.3, speed: 0.45, phase: 0.6 },
].map((w) => ({
  kx: w.lengthX ? 1 / w.lengthX : 0,
  kz: w.lengthZ ? 1 / w.lengthZ : 0,
  amplitude: w.amplitude,
  speed: w.speed,
  phase: w.phase,
}))

/** Gap between a system's ring and its label chip. Authored in rem so it keeps
    its proportion under the fluid root scale, resolved to px where used. */
const LABEL_GAP_REM = 1

/** Smallest gap left between a label chip and the canvas edge. */
const LABEL_EDGE_PX = 6

/** How far above its node a chip sits on the mobile strip — see the placement
    branch in SystemNode. Enough to clear the marker's ring at its widest (the
    pulse reaches 2.6x) plus half the chip's own height, since the chip is
    centred on this point. */
const LABEL_ABOVE_PX = 24

/** Fog hides the hard outer edge of the grid — without it the sea ends in a
    visible rectangle on the horizon in the profile view. It also fades the far
    end of the hull when viewed down its length, which reads as depth.

    These are tuned against a standing distance of MIN_DISTANCE. They are NOT
    used as-is: SceneFog shifts the whole window out by however far past
    MIN_DISTANCE the camera actually stands, so a viewport whose solve puts the
    camera further back keeps the same depth relationship instead of pushing
    the vessel into the fog — at portrait aspects the old fixed window sat
    entirely in front of the hull and erased it. */
const FOG_NEAR = 140
const FOG_FAR = 380

/* Design tokens are authored in oklch, which THREE.Color cannot parse. These
   are the exact sRGB conversions of the values in index.css — if a token moves
   there, re-convert rather than eyeballing a replacement. */
const COLOR = {
  navy950: '#04101e',
  navy900: '#0a1c2d',
  signal500: '#00b4d5',
  signal300: '#7ae4f3',
  /* The system markers, and the only warm thing in the scene. The vessel, its
     linework and the sea are all drawn in signal cyan, so a cyan marker had to
     compete with the drawing it sits on; orange has nothing to compete with and
     reads instantly as an annotation rather than as part of the ship. It is the
     same alert-500 the emergency actions use. */
  alert500: '#f49329',
} as const

type Progress = { current: number }

function Vessel({ still, children }: { still: boolean; children?: ReactNode }) {
  const { scene } = useGLTF(MODEL_URL, DRACO_PATH)
  const motion = useRef<THREE.Group>(null)

  // The GLB is a single unmaterialed mesh; take its geometry directly.
  const geometry = useMemo<THREE.BufferGeometry | null>(() => {
    let found: THREE.BufferGeometry | null = null
    scene.traverse((child) => {
      if (!found && (child as THREE.Mesh).isMesh) found = (child as THREE.Mesh).geometry
    })
    return found
  }, [scene])

  const edges = useMemo(
    () => (geometry ? new THREE.EdgesGeometry(geometry, EDGE_ANGLE) : null),
    [geometry],
  )

  // Model origin is at the keel, aft — centre it so the camera orbits
  // amidships rather than swinging the ship around the frame.
  const centre = useMemo(() => {
    if (!geometry) return new THREE.Vector3()
    geometry.computeBoundingBox()
    return geometry.boundingBox!.getCenter(new THREE.Vector3())
  }, [geometry])

  // EdgesGeometry allocates its own buffers and is not owned by the loader
  // cache, so nothing else will collect it.
  useEffect(() => () => edges?.dispose(), [edges])

  // Readiness beacon for the tests: the GLB load and edge extraction are the
  // slow, async part of first paint, and nothing else in the DOM says when
  // they are done. Screenshots taken before this lands show an empty sea.
  useEffect(() => {
    if (!edges) return
    document.documentElement.dataset.vesselReady = '1'
    // Same moment, for the intro curtain — which is covering exactly this wait
    // and lifts as soon as there is a drawing behind it.
    markVesselReady()
    return () => {
      delete document.documentElement.dataset.vesselReady
    }
  }, [edges])

  useFrame(({ clock }) => {
    const g = motion.current
    if (!g) return

    // Held at the rest pose under prefers-reduced-motion. Returning early
    // would freeze it mid-roll instead, leaving the ship stuck at a list.
    if (still) {
      g.rotation.set(0, 0, 0)
      g.position.y = 0
      return
    }

    const t = clock.getElapsedTime()
    g.rotation.x = THREE.MathUtils.degToRad(MOTION.rollDeg) * Math.sin((TAU * t) / MOTION.rollPeriod)
    g.rotation.z =
      THREE.MathUtils.degToRad(MOTION.pitchDeg) * Math.sin((TAU * t) / MOTION.pitchPeriod + 1.1)
    g.rotation.y =
      THREE.MathUtils.degToRad(MOTION.yawDeg) * Math.sin((TAU * t) / MOTION.yawPeriod + 0.4)
    g.position.y = MOTION.heave * Math.sin((TAU * t) / MOTION.heavePeriod + 2.3)
  })

  if (!geometry || !edges) return null

  return (
    // Outer group carries the seakeeping; the inner one centres the model, so
    // the vessel rolls and pitches about amidships rather than about the keel
    // at the stern — which would swing the bow through a huge arc.
    <group ref={motion}>
      {/* Children ride the seakeeping and sit in CENTRED space (the inner
          group below is what shifts model space to centred), so a system
          anchor stays pinned to its part of the ship as she rolls. */}
      {children}
      <group position={[-centre.x, -centre.y, -centre.z]}>
        {/* Opaque fill, pushed fractionally back so it occludes the far side of
            the hull without z-fighting its own edges along every crease. */}
        <mesh geometry={geometry}>
          <meshBasicMaterial
            color={COLOR.navy900}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
        <lineSegments geometry={edges}>
          <lineBasicMaterial color={COLOR.signal500} transparent opacity={0.85} />
        </lineSegments>
      </group>
    </group>
  )
}

/** Ring in the XY plane; billboarded to the camera so it always reads round. */
function ringGeometry(radius: number): THREE.BufferGeometry {
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * TAU
    points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0))
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

/**
 * A system marker on the hull. Lives inside the vessel's motion group, so it
 * rolls with her, and each frame it projects its own world position to screen
 * coordinates and drives a DOM label there — the text stays real DOM (crisp at
 * any density, selectable, translatable) rather than drawn into the canvas.
 */
function SystemNode({
  spec,
  progress,
  labels,
  index,
}: {
  spec: SystemSpec
  progress: Progress
  labels: RefObject<Array<HTMLDivElement | null>>
  index: number
}) {
  const group = useRef<THREE.Group>(null)
  const pulse = useRef<THREE.Group>(null)
  const innerMat = useRef<THREE.LineBasicMaterial>(null)
  const outerMat = useRef<THREE.LineBasicMaterial>(null)

  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  const inner = useMemo(() => ringGeometry(1.1), [])
  const outer = useMemo(() => ringGeometry(1.1), [])
  const world = useMemo(() => new THREE.Vector3(), [])

  // Chip width and the gap between node and chip, measured off the frame loop.
  // The placement below needs both every frame, and reading offsetWidth there
  // would force a layout on nine elements per frame.
  const chipWidth = useRef(0)
  const gapPx = useRef(LABEL_GAP_REM * 16)

  useEffect(() => {
    const measure = () => {
      const chip = labels.current[index]?.firstElementChild
      if (!(chip instanceof HTMLElement)) return
      chipWidth.current = chip.offsetWidth
      // The gap is authored in rem so it tracks the fluid root scale; resolve
      // it to px here, where reading the root's computed size is free.
      const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      gapPx.current = LABEL_GAP_REM * root
    }
    measure()
    // Webfonts land after first paint and change the chip's width.
    void document.fonts?.ready.then(measure)
  }, [labels, index, size.width])

  useEffect(
    () => () => {
      inner.dispose()
      outer.dispose()
    },
    [inner, outer],
  )

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return

    const active = systemActivity(progress.current, spec.at)
    g.visible = active > 0.001

    // Face the camera, so the rings never foreshorten into ellipses.
    g.quaternion.copy(camera.quaternion)

    // Expanding ring, restarting every 2.4s. Pinned mid-pulse under test so
    // the ring is both visible in the baselines and identical on every run.
    const phase = E2E ? 0.35 : (clock.getElapsedTime() % 2.4) / 2.4
    if (pulse.current) pulse.current.scale.setScalar(1 + phase * 2.6)
    if (outerMat.current) outerMat.current.opacity = active * (1 - phase) * 0.7
    if (innerMat.current) innerMat.current.opacity = active * 0.95

    // Project to screen and drive the DOM label. Written straight to style —
    // this runs every frame and must never go through React state.
    const label = labels.current[index]
    if (label) {
      g.getWorldPosition(world).project(camera)
      // z > 1 means the anchor is behind the camera, where the projection
      // flips and the label would appear mirrored on the wrong side.
      // Outside NDC means the node is out of frame: harmless when the canvas
      // is the whole viewport, but on the mobile strip the label would escape
      // the canvas band and land on the article text below it.
      const hidden =
        world.z > 1 || Math.abs(world.x) > 1 || Math.abs(world.y) > 1

      // Placement, in canvas pixels.
      const x = (world.x * 0.5 + 0.5) * size.width
      const y = (-world.y * 0.5 + 0.5) * size.height
      const w = chipWidth.current
      const gap = gapPx.current
      const mobile = size.width < MOBILE_LAYOUT_WIDTH

      let left: number
      let top = y

      if (mobile) {
        // ABOVE the node, centred over it.
        //
        // Beside it does not work on a phone: the names are long ("Electric
        // Motors & Drives") and the strip is narrow, so a chip fits on neither
        // side of a node near the middle and ends up clamped back over the very
        // ring it is labelling — hiding the thing it is pointing at.
        //
        // Clear of it vertically, the ring stays visible whatever the name's
        // length, and the only cost is that a chip near the edge is clamped
        // sideways, which moves it along the hull rather than over the marker.
        left = w > 0 ? x - w / 2 : x
        top = y - LABEL_ABOVE_PX
      } else {
        // Beside it: to the RIGHT by default, swinging left when that would
        // overhang the canvas. There is room for both here.
        left = x + gap
        if (w > 0 && left + w > size.width - LABEL_EDGE_PX) left = x - gap - w
      }

      if (w > 0) {
        left = THREE.MathUtils.clamp(
          left,
          LABEL_EDGE_PX,
          Math.max(LABEL_EDGE_PX, size.width - w - LABEL_EDGE_PX),
        )
      }

      label.style.transform = `translate3d(${left}px, ${top}px, 0)`
      label.style.opacity = String(hidden ? 0 : active)
    }
  })

  return (
    <group ref={group} position={spec.anchor}>
      {/* depthTest off, so a node reads through the hull.
          Most systems sit INSIDE the ship — the engine room, the switchboard,
          the accommodation — and with depth testing on, the opaque fill hides
          them completely; only the masthead one ever showed. Since the marker
          is an annotation rather than an object in the scene, it should behave
          like one and always sit on top.
          renderOrder forces it to draw after the hull; with depthTest off,
          draw order is the only thing left deciding what wins. */}
      <lineLoop geometry={inner} renderOrder={10}>
        <lineBasicMaterial
          ref={innerMat}
          color={COLOR.alert500}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </lineLoop>
      <group ref={pulse}>
        <lineLoop geometry={outer} renderOrder={10}>
          <lineBasicMaterial
            ref={outerMat}
            color={COLOR.alert500}
            transparent
            depthTest={false}
            depthWrite={false}
          />
        </lineLoop>
      </group>
    </group>
  )
}

/** Vertex lattice: a row line and a column line through every node, so the
    surface reads as squares. Positions in x/z are fixed; only y is animated. */
function buildSeaLattice(): THREE.BufferGeometry {
  const n = GRID_DIVISIONS + 1
  const half = GRID_EXTENT / 2
  const step = GRID_EXTENT / GRID_DIVISIONS

  const positions = new Float32Array(n * n * 3)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const o = (j * n + i) * 3
      positions[o] = -half + i * step
      positions[o + 1] = 0
      positions[o + 2] = -half + j * step
    }
  }

  const indices: number[] = []
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * n + i
      if (i < n - 1) indices.push(a, a + 1)
      if (j < n - 1) indices.push(a, a + n)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  // 4 components, not 3: three only honours per-vertex ALPHA when the colour
  // attribute is RGBA. With itemSize 3 the fade would silently do nothing.
  // RGB stays white so the material's own colour still tints the lines.
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * n * 4), 4))
  geometry.setIndex(indices)
  return geometry
}

function Waterplane({ still }: { still: boolean }) {
  const drift = useRef<THREE.Group>(null)
  const settled = useRef(false)

  const geometry = useMemo(buildSeaLattice, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ clock }) => {
    const g = drift.current
    if (!g) return

    // ~3.7k vertices x 4 components. Cheap enough per frame, but it is real
    // work — under reduced motion the surface is written once and left alone.
    if (still && settled.current) return
    const t = still ? 0 : clock.getElapsedTime()

    const offset = still ? 0 : -((t * SEA_DRIFT) % DRIFT_WRAP)
    g.position.x = offset

    const posAttr = geometry.attributes.position as THREE.BufferAttribute
    const colAttr = geometry.attributes.color as THREE.BufferAttribute
    const pos = posAttr.array as Float32Array
    const col = colAttr.array as Float32Array

    const count = posAttr.count
    for (let v = 0; v < count; v++) {
      const p = v * 3
      const x = pos[p]
      const z = pos[p + 2]

      let y = 0
      for (const w of SEA_WAVES) {
        y += w.amplitude * Math.sin(TAU * (x * w.kx + z * w.kz) + t * w.speed + w.phase)
      }
      pos[p + 1] = y

      // Fade on distance from the vessel in world space — hence + offset,
      // which cancels the lattice's own drift. Each axis is divided by its own
      // radius first, so r = 1 lands on the ellipse whatever the bearing.
      const radius = Math.hypot((x + offset) / SEA_FADE_X, z / SEA_FADE_Z)
      const c = v * 4
      col[c] = 1
      col[c + 1] = 1
      col[c + 2] = 1
      col[c + 3] = 1 - THREE.MathUtils.smoothstep(radius, SEA_FADE_SOFTNESS, 1)
    }

    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    settled.current = true
  })

  return (
    <group ref={drift} position={[0, GRID_Y, 0]}>
      <lineSegments geometry={geometry}>
        {/* depthWrite off so the sea never occludes the hull sitting in it,
            while depth testing still lets the hull occlude the sea behind. */}
        <lineBasicMaterial
          color={COLOR.signal500}
          vertexColors
          transparent
          opacity={0.13}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}

/**
 * Drives the camera from scroll position. Reads a ref rather than state so
 * scrolling never triggers a React render — the whole sweep is one matrix
 * update per frame.
 */
/**
 * Eases the scene's progress toward the raw scroll position, and drives
 * everything that depends on it.
 *
 * Mounted FIRST inside the canvas so its useFrame runs before the camera and
 * the markers — R3F runs frame callbacks of equal priority in mount order, so
 * the rest of the scene reads a value already current for this frame.
 *
 * The panel opacity and the active-system swap live here rather than in the
 * scroll handler so they follow the SAME eased value the camera does. Driven
 * from the raw scroll they would change a beat ahead of the movement, which
 * reads as the diagram and the ship disagreeing with each other.
 */
function ProgressDriver({
  target,
  progress,
  panelEl,
  introEl,
  readoutEl,
  onSystemChange,
}: {
  target: Progress
  progress: Progress
  panelEl: RefObject<HTMLDivElement | null>
  introEl: RefObject<HTMLDivElement | null>
  readoutEl: RefObject<HTMLDivElement | null>
  onSystemChange: (index: number) => void
}) {
  useFrame((_, delta) => {
    // Frame-rate independent exponential smoothing. A plain `+= diff * 0.1`
    // eases at different speeds on a 60Hz and a 144Hz display; this does not.
    // delta is clamped so a backgrounded tab does not resume with one huge
    // step that snaps the whole sweep across in a single frame.
    // Under test the easing is bypassed entirely: the tests scroll straight
    // to a stop and screenshot, and any residual glide would land each run on
    // a fractionally different frame.
    const k = E2E ? 1 : 1 - Math.exp(-SCROLL_DAMPING * Math.min(delta, 0.1))
    progress.current += (target.current - progress.current) * k

    const p = progress.current
    const { index, activity } = dominantSystem(p)

    if (panelEl.current) panelEl.current.style.opacity = String(activity)
    if (readoutEl.current) readoutEl.current.textContent = `${(p * 100).toFixed(1)}%`

    if (introEl.current) {
      const intro = introActivity(p)
      introEl.current.style.opacity = String(intro)
      // A faded overlay still swallows clicks, so the intro's buttons would
      // keep intercepting them over the whole page. Only accept input while
      // it is actually the thing on screen.
      introEl.current.style.pointerEvents = intro > 0.5 ? 'auto' : 'none'
    }

    onSystemChange(index)
  })

  return null
}

/**
 * The framing fraction for a canvas of this size — the strip stage gets the
 * larger mobile share. Canvas width, not window width: the two coincide on
 * mobile (the strip is full-bleed) and the desktop canvas is the viewport.
 *
 * On mobile the fraction is scaled by the strip's aspect when the strip is
 * taller than it is wide, and this is not cosmetic: standingDistance clamps
 * aspect to 1, so a portrait frame is fitted against its HEIGHT. The vessel is
 * a horizontal object in a frame whose height now changes (see
 * MOBILE_STRIP_OPEN), and without this it is drawn 60/26ths larger when the
 * strip opens — enough to push the bow off the side of the screen.
 *
 * Multiplying by width/height cancels that exactly: the span works out at the
 * same share of the strip's WIDTH whatever its height, so the vessel keeps one
 * size on screen and the strip's two states differ only in how much sea and sky
 * they show. Above aspect 1 the solve is already fitting against width, and the
 * fraction is left alone.
 */
function shipFraction(width: number, height: number): number {
  if (width >= MOBILE_LAYOUT_WIDTH) return SHIP_FRACTION
  return MOBILE_SHIP_FRACTION * Math.min(1, width / height)
}

/** Fog whose window tracks the camera's standing distance — see the note on
    FOG_NEAR. Additive rather than proportional: the depth of the window is
    part of the look, only its position follows the camera out. */
function SceneFog() {
  const size = useThree((s) => s.size)
  const shift =
    standingDistance(size.width / size.height, shipFraction(size.width, size.height)) - MIN_DISTANCE
  return <fog attach="fog" args={[COLOR.navy950, FOG_NEAR + shift, FOG_FAR + shift]} />
}

function CameraRig({ progress }: { progress: Progress }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)

  // Reused every frame; focusTarget writes into it rather than allocating.
  const focus = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    camera.fov = FOV
    // Pan the projection right and down, which sits the subject left and high
    // in the frame — without rotating the camera and skewing the views.
    // Desktop-only: the mobile strip IS the vessel's whole stage, so the
    // subject stays centred in it and no pan is wanted.
    const mobile = size.width < MOBILE_LAYOUT_WIDTH
    camera.setViewOffset(
      size.width,
      size.height,
      mobile ? 0 : size.width * LEFT_SHIFT,
      // Negative on mobile, where the sign is doing the opposite job: desktop
      // lifts the vessel up the frame, while the strip pushes it DOWN, out from
      // under the floating header. See MOBILE_HEADER_PX.
      mobile ? -MOBILE_HEADER_PX / 2 : size.height * UP_SHIFT,
      size.width,
      size.height,
    )
    camera.updateProjectionMatrix()
    return () => {
      camera.clearViewOffset()
    }
  }, [camera, size])

  useFrame(() => {
    const p = progress.current

    // One continuous arc around the vessel — astern, abeam, ahead — split into
    // two eased halves. smoothstep arrives and departs with zero gradient, so
    // the camera genuinely settles at the beam-on profile rather than sailing
    // straight through it, and the hand-off at p = 0.5 has no visible corner.
    const toProfile = THREE.MathUtils.smoothstep(p, 0, 0.5)
    const toBow = THREE.MathUtils.smoothstep(p, 0.5, 1)

    const elevationDeg = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(ELEVATION_STERN, ELEVATION_SIDE, toProfile),
      ELEVATION_BOW,
      toBow,
    )
    const azimuthDeg = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(AZIMUTH_STERN, AZIMUTH_SIDE, toProfile),
      AZIMUTH_BOW,
      toBow,
    )

    const elevation = THREE.MathUtils.degToRad(elevationDeg)
    const azimuth = THREE.MathUtils.degToRad(azimuthDeg)

    // Fixed-radius orbit: the distance is solved once for the OPENING view and
    // held for the whole sweep, rather than re-solved per frame from what the
    // vessel currently presents. The camera therefore never dollies — the ship
    // genuinely grows as it turns broadside and shows its full length, which
    // is what a camera circling a real vessel at constant range would see.
    // Still solved against aspect, so the opening shot frames identically on
    // any viewport — see standingDistance for the portrait clamp.
    // Push in toward the profile, back out at both three-quarter views.
    const closeIn = THREE.MathUtils.lerp(1, PROFILE_DISTANCE_SCALE, Math.sin(Math.PI * p))
    const distance =
      standingDistance(size.width / size.height, shipFraction(size.width, size.height)) * closeIn

    // The rig now tracks the system being annotated, rather than following a
    // fixed choreography: the look-at walks amidships -> 01 -> 02 -> ... -> 09,
    // settling on each anchor exactly where that system's node is fully lit.
    const target = focusTarget(p, focus)

    const horizontal = distance * Math.cos(elevation)
    // Target added to BOTH position and look-at: that translates the whole rig
    // without rotating it, so the orbit angles stay true. Offsetting only the
    // look-at would yaw the camera and skew every view.
    camera.position.set(
      target.x + horizontal * Math.sin(azimuth),
      target.y + distance * Math.sin(elevation),
      target.z + horizontal * Math.cos(azimuth),
    )
    camera.lookAt(target)
  })

  return null
}

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
      const stripBottom = THREE.MathUtils.clamp(stripRect?.bottom ?? 0, 0, vh)
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
      const opening = THREE.MathUtils.clamp(past / (OPENING_TRAVEL * vh), 0, 1)
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

      target.current = THREE.MathUtils.clamp(p, 0, 1)

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
      scrollTarget.current = THREE.MathUtils.clamp(scrolled / travel, 0, 1)
    }

    update()
    // capture: true so a scroll on any inner element reaches this too —
    // scroll events do not bubble, but they do run the capture phase.
    window.addEventListener('scroll', update, { passive: true, capture: true })
    window.addEventListener('resize', update)
    return () => {
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
  if (webgl === null) return <HeroSeaScene label={label} />

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
        <Canvas
          camera={{ position: [0, 240, 20], fov: FOV, far: 4000 }}
          // At 3x on a phone this is four times the fragments of 1.75x for no
          // visible gain on linework.
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => gl.setClearColor(COLOR.navy950)}
          aria-hidden="true"
        >
          {/* First inside the canvas: its frame callback must run before the
              camera and markers read the eased value. */}
          <ProgressDriver
            target={scrollTarget}
            progress={progress}
            panelEl={panelEl}
            introEl={introEl}
            readoutEl={readout}
            onSystemChange={handleSystemChange}
          />
          <SceneFog />
          <Suspense fallback={null}>
            <Vessel still={still}>
              {SYSTEMS.map((spec, i) => (
                <SystemNode
                  key={spec.index}
                  spec={spec}
                  index={i}
                  progress={progress}
                  labels={labelEls}
                />
              ))}
            </Vessel>
          </Suspense>
          <Waterplane still={still} />
          <CameraRig progress={progress} />
        </Canvas>

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

useGLTF.preload(MODEL_URL, DRACO_PATH)
