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
  signal300: '#7ae4f3',
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
      const behind = world.z > 1
      label.style.transform = `translate3d(${(world.x * 0.5 + 0.5) * size.width}px, ${
        (-world.y * 0.5 + 0.5) * size.height
      }px, 0)`
      label.style.opacity = String(behind ? 0 : active)
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
          color={COLOR.signal300}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </lineLoop>
      <group ref={pulse}>
        <lineLoop geometry={outer} renderOrder={10}>
          <lineBasicMaterial
            ref={outerMat}
            color={COLOR.signal300}
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

function CameraRig({ progress }: { progress: Progress }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)

  // Reused every frame; focusTarget writes into it rather than allocating.
  const focus = useMemo(() => new THREE.Vector3(), [])

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
    // max-h keeps the panel inside the viewport whatever its content: 4rem of
    // that budget is the fixed header, which a vertically-centred panel would
    // otherwise slide under on a short screen.
    <div className="border-navy-800 bg-navy-950/90 max-h-[52dvh] overflow-y-auto rounded-lg border p-4 backdrop-blur-sm lg:max-h-[calc(100dvh-9rem)] lg:p-6">
      <p className="text-signal-500/80 font-mono text-[10px] tracking-[0.2em]">
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

  // Resolved after mount — touches APIs that only exist in a browser.
  const [webgl, setWebgl] = useState(false)
  const [still, setStill] = useState(E2E)

  // Snapping is applied to the document element here rather than in index.css
  // so it belongs to this scene: the rest of the site scrolls normally, and
  // the setting is torn down when the hero unmounts on navigation.
  useEffect(() => {
    const root = document.documentElement
    const previous = root.style.scrollSnapType
    root.style.scrollSnapType = 'y mandatory'
    return () => {
      root.style.scrollSnapType = previous
    }
  }, [])

  useEffect(() => {
    setWebgl(hasWebGL())

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

      // Only the TARGET is written here. ProgressDriver eases the scene toward
      // it each frame, so a hard snap correction becomes a glide instead of a
      // jump. Everything downstream reads the eased value, never this one.
      scrollTarget.current = travel <= 0 ? 0 : THREE.MathUtils.clamp(scrolled / travel, 0, 1)
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
          <fog attach="fog" args={[COLOR.navy950, FOG_NEAR, FOG_FAR]} />
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
      </div>

      {/* One label per system, pinned to its node. `left/top: 0` with a
          transform written each frame — transforms are composited, so tracking
          the node costs nothing, whereas animating left/top forces layout. */}
      {SYSTEMS.map((spec, i) => (
        <div
          key={spec.index}
          ref={(el) => {
            labelEls.current[i] = el
          }}
          className="pointer-events-none fixed top-0 left-0 z-40 opacity-0"
          style={{ willChange: 'transform' }}
          aria-hidden="true"
        >
          <div className="border-signal-400/50 bg-navy-950/85 text-signal-300 -translate-y-1/2 translate-x-4 rounded border px-2 py-1 font-mono text-[10px] tracking-[0.14em] whitespace-nowrap uppercase">
            {spec.title}
          </div>
        </div>
      ))}

      {/* Company intro, holding the first stop before any system appears.
          Sits in the same right-hand column the diagrams use, so the eye does
          not have to move when the first system takes over from it. */}
      {intro && (
        <div
          ref={introEl}
          data-testid="hero-intro"
          className="fixed inset-x-3 bottom-3 z-40 lg:inset-x-auto lg:top-1/2 lg:right-10 lg:bottom-auto lg:w-[min(28rem,40vw)] lg:-translate-y-1/2"
        >
          {intro}
        </div>
      )}

      {/* The diagram carries the technical content the model cannot. */}
      <div
        ref={panelEl}
        data-testid="system-panel"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-40 opacity-0 lg:inset-x-auto lg:top-1/2 lg:right-10 lg:bottom-auto lg:w-[min(28rem,40vw)] lg:-translate-y-1/2"
        aria-hidden="true"
      >
        {activeSystem >= 0 && <SystemPanel spec={SYSTEMS[activeSystem]} />}
      </div>

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
      <div ref={stops} data-scroll-stops aria-hidden="true">
        {Array.from({ length: SNAP_STOPS }, (_, i) => (
          <div key={i} className="h-screen" style={{ scrollSnapAlign: 'start' }} />
        ))}
      </div>
    </>
  )
}

useGLTF.preload(MODEL_URL, DRACO_PATH)
