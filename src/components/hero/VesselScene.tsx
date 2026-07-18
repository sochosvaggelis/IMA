import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { HeroSeaScene } from './HeroSeaScene'

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
 * Underneath those three stops the look-at also tracks along the hull (see
 * ORBIT_TRAVEL and LOOK_AFT): amidships at the start, the after end at the
 * profile, then forward toward the bow as it closes.
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
 * Longitudinal travel. The whole camera rig slides from aft to forward along
 * the hull across the scroll, so the vantage point drifts bow-ward while the
 * three orbit stops play out on top of it.
 *
 * Applied to the camera position AND its look-at target equally. That is what
 * makes it a translation rather than a rotation: the view direction is
 * (target - position), so shifting both leaves orientation untouched and the
 * plan view stays axis-aligned. Moving the target alone would yaw the camera
 * and skew every view — the same trap the frustum shift avoids.
 *
 * The travel starts at ZERO rather than aft of the vessel, so the opening
 * frame is composed exactly as it was before this existed. From there it runs
 * AFT into the profile stop, then forward again for the plan:
 *
 *     p = 0.0   amidships   (opening framing, untouched)
 *     p = 0.5   the stern   (profile view centres on the after end)
 *     p = 1.0   forward     (plan view drifts toward the bow)
 *
 * Raise ORBIT_TRAVEL for a longer push toward the bow — past ~50 the camera is
 * looking beyond the stem.
 */
const ORBIT_TRAVEL = 32

/** How far aft the profile stop centres. The hull's half-length is 50, so 35
    sits well inside the after end rather than off the transom. */
const LOOK_AFT = 35

/** Which way the stern lies along X, derived from the opening azimuth so the
    two can never disagree: at p = 0 the camera sits astern, so the sign of its
    X position IS the stern direction. Flip AZIMUTH_STERN and this follows. */
const STERN_SIGN = Math.sign(Math.sin((AZIMUTH_STERN * Math.PI) / 180))

/** Fraction of viewport width the image is panned right, which moves the
    vessel that much left. 0.22 puts its centre at ~28% from the left edge. */
const LEFT_SHIFT = 0.22

/** Same trick on the vertical axis: panning the projection down lifts the
    vessel up the frame. Raise to lift further, negative to drop it. */
const UP_SHIFT = 0.08

/** Viewport heights of scroll the full sweep is spread over. The vessel layer
    is fixed, so it contributes no height of its own — this spacer is what
    creates the scroll distance the sweep is mapped onto. */
const SWEEP_SCROLL_VH = 400

/** On-screen scroll readout for tuning the sweep. Flip to false to hide it —
    this is a development aid and should not ship. */
const DEBUG_SCROLL = true

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

/** Fog hides the hard outer edge of the grid — without it the sea ends in a
    visible rectangle on the horizon in the profile view. It also fades the far
    end of the hull when viewed down its length, which reads as depth. */
const FOG_NEAR = 140
const FOG_FAR = 380

/* Design tokens are authored in oklch, which THREE.Color cannot parse. These
   are the exact sRGB conversions of the values in index.css — if a token moves
   there, re-convert rather than eyeballing a replacement. */
const COLOR = {
  navy950: '#04101e',
  navy900: '#0a1c2d',
  signal500: '#00b4d5',
} as const

type Progress = { current: number }

function Vessel({ still }: { still: boolean }) {
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

  if (!geometry) return null

  return (
    // Outer group carries the seakeeping; the inner one centres the model, so
    // the vessel rolls and pitches about amidships rather than about the keel
    // at the stern — which would swing the bow through a huge arc.
    <group ref={motion}>
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
function CameraRig({ progress }: { progress: Progress }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)

  useEffect(() => {
    camera.fov = FOV
    // Pan the projection right and down, which sits the subject left and high
    // in the frame — without rotating the camera and skewing the views.
    camera.setViewOffset(
      size.width,
      size.height,
      size.width * LEFT_SHIFT,
      size.height * UP_SHIFT,
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
    // any viewport.
    const aspect = size.width / size.height
    const fit =
      FRAMING_EXTENT / (2 * SHIP_FRACTION) / (Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * aspect)
    // Push in toward the profile, back out at both three-quarter views.
    const closeIn = THREE.MathUtils.lerp(1, PROFILE_DISTANCE_SCALE, Math.sin(Math.PI * p))
    const distance = Math.max(fit, MIN_DISTANCE) * closeIn

    // Amidships -> stern -> forward, reusing the same two eased halves as the
    // orbit so the look-at arrives at the after end exactly as the profile
    // view settles, then releases forward into the climb.
    const travel = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(0, STERN_SIGN * LOOK_AFT, toProfile),
      -STERN_SIGN * ORBIT_TRAVEL,
      toBow,
    )

    const horizontal = distance * Math.cos(elevation)
    camera.position.set(
      travel + horizontal * Math.sin(azimuth),
      distance * Math.sin(elevation),
      horizontal * Math.cos(azimuth),
    )
    // Same travel on the target: translates the rig, does not rotate it.
    camera.lookAt(travel, 0, 0)
  })

  return null
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

export function VesselScene({ label }: { label: string }) {
  const progress = useRef(0)
  const readout = useRef<HTMLDivElement>(null)

  // Resolved after mount — touches APIs that only exist in a browser.
  const [webgl, setWebgl] = useState(false)
  const [still, setStill] = useState(false)

  useEffect(() => {
    setWebgl(hasWebGL())

    // Seakeeping is unprompted motion, so it honours the OS setting. The
    // scroll sweep is not affected — that one the user is driving themselves.
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = () => setStill(motion.matches)
    syncMotion()
    motion.addEventListener('change', syncMotion)

    // Mapped over the whole document rather than one element: the vessel is
    // on screen for the entire page, so the sweep should be too.
    const update = () => {
      const doc = document.documentElement
      // Whichever element is actually scrolling. If the document itself is not
      // the scroller, window.scrollY stays pinned at 0 no matter how far the
      // user scrolls — which is what leaves a scroll-driven rig frozen.
      const scrolled = window.scrollY || doc.scrollTop || document.body.scrollTop || 0
      const travel = doc.scrollHeight - window.innerHeight

      progress.current = travel <= 0 ? 0 : THREE.MathUtils.clamp(scrolled / travel, 0, 1)

      // Written straight to the DOM rather than through state: this fires on
      // every scroll event, and a setState here would re-render the whole
      // scene tree for a debug label.
      if (readout.current) {
        readout.current.textContent = `${(progress.current * 100).toFixed(1)}%`
      }
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

  if (!webgl) return <HeroSeaScene label={label} />

  return (
    <>
      {/* Fixed, so the vessel never leaves the viewport.
          `-z-10` is deliberate: a fixed element at z-0 creates a stacking
          context and would paint OVER the page's static content. A negative
          index still paints above the body background, so the vessel sits
          behind the copy rather than on top of it. */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        role="img"
        aria-label={label}
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
          <fog attach="fog" args={[COLOR.navy950, FOG_NEAR, FOG_FAR]} />
          <Suspense fallback={null}>
            <Vessel still={still} />
          </Suspense>
          <Waterplane still={still} />
          <CameraRig progress={progress} />
        </Canvas>
      </div>

      {/* Sits outside the vessel layer: that one is at -z-10 and would put the
          readout behind the page background. */}
      {DEBUG_SCROLL && (
        <div
          ref={readout}
          className="bg-navy-950/90 text-signal-400 border-navy-800 pointer-events-none fixed top-3 right-3 z-50 rounded border px-2 py-1 font-mono text-[11px] leading-relaxed whitespace-pre tabular-nums"
        >
          0.0%
        </div>
      )}

      {/* A fixed layer contributes no height, so without this there is nothing
          to scroll and the sweep can never advance past p = 0. */}
      <div style={{ height: `${SWEEP_SCROLL_VH}vh` }} aria-hidden="true" />
    </>
  )
}

useGLTF.preload(MODEL_URL, DRACO_PATH)
