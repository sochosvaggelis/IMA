import * as THREE from 'three'
import {
  AutomationControl,
  CargoSystems,
  EngineRoomElectrical,
  LightingAccommodation,
  MotorsAndDrives,
  NavigationComms,
  PowerDistribution,
  PowerGeneration,
  SafetySystems,
} from './diagrams'

/**
 * The nine systems, each tying together three things: WHERE it lives on the
 * vessel (anchor), WHEN it appears (scroll centre), and WHAT it is (diagram).
 *
 * ANCHORS are in centred model space — X runs aft(-) to bow(+) over -50..+50,
 * Y is up over -12.5..+12.5 with the keel at the bottom, Z is the beam.
 *
 * ---------------------------------------------------------------------------
 * Y VALUES ARE MEASURED FROM THE MESH, NOT ESTIMATED. The hull's actual
 * vertical profile along X (centred Y of the highest geometry in each slab):
 *
 *     X  -46..-42     top  +7.1     superstructure
 *     X  -42..-38     top +12.5     mast and bridge — the highest point
 *     X  -38..-34     top  +9.9     accommodation
 *     X  -30..-22     top  -3.0     MAIN DECK, nothing above it
 *     X   cranes      top  +6.6     deck cranes only
 *
 * The deck sits at -3.0 over the whole cargo length, so anything placed above
 * that between roughly X -30 and +35 is hanging in mid-air. An earlier pass
 * put the accommodation node at (-29, +5) and the bridge at (-26, +10), both
 * of which floated clear of the ship. Superstructure anchors must stay aft of
 * about X = -34, where there is actually something to attach to.
 *
 * THE ORDER OF THIS ARRAY IS ALSO THE CAMERA PATH, AND ITS X VALUES MUST
 * INCREASE MONOTONICALLY:
 *
 *     -47  -45  -43  -42  -41  -40  -16  +12  +42
 *
 * The camera walks these anchors in order, so any anchor that steps backwards
 * makes it double back on itself and the sweep stops reading as one continuous
 * move from stern to bow. That is why the systems are sequenced by POSITION
 * rather than by the order you would list them on a capability sheet: deepest
 * machinery first, then the switchboards, up through the accommodation and
 * bridge, out along the deck, and finally the bow thruster.
 *
 * Each is still at its true location on a bulk carrier — the machinery space
 * and accommodation genuinely are aft on this ship type, and the bow thruster
 * genuinely is at the stem. Reordering for the camera cost no honesty.
 * ---------------------------------------------------------------------------
 *
 * SCROLL CENTRES are evenly spaced at 0.10 intervals. Each window is 0.10
 * wide (see systemActivity), so the nine tile the sweep end to end with the
 * fades meeting at zero.
 */
export type SystemSpec = {
  index: string
  title: string
  blurb: string
  /** Where the marker and its label sit on the vessel. */
  anchor: THREE.Vector3
  /**
   * Where the camera looks, when that should differ from the marker.
   *
   * The two are the same thing by default, but they are different jobs: the
   * anchor points at equipment, while this composes the shot. Separating them
   * lets a marker be nudged for legibility without swinging the camera, or the
   * framing be raised without dragging the marker off its equipment.
   *
   * NOTE: it is these values — not the anchors — that must increase
   * monotonically, since this is what the camera actually walks along.
   */
  focus?: THREE.Vector3
  /** Scroll position, 0..1, where this system is fully shown. */
  at: number
  Diagram: () => React.ReactElement
}

/** Camera target for a system: its own if given, otherwise its marker. */
export function focusOf(spec: SystemSpec): THREE.Vector3 {
  return spec.focus ?? spec.anchor
}

export const SYSTEMS: SystemSpec[] = [
  {
    index: '01',
    title: 'Power Generation',
    blurb:
      'Diesel generator sets, automatic voltage regulation, synchronising and load sharing, preferential tripping and emergency changeover.',
    // Generator flat in the engine room: below the main deck (-3) but above
    // the waterline (-9), aft where the machinery space sits.
    anchor: new THREE.Vector3(-44, -7, 0),
    // Lifted clear of the marker so the shot is not looking up from below the
    // waterline, and slid along screen-right to push the vessel further left
    // in frame. At 67deg off the beam that direction is ~92% Z, so the shift
    // rides on Z: putting it on X would run past the next system and make the
    // camera double back.
    focus: new THREE.Vector3(-44, -3, 8),
    at: 0.1,
    Diagram: PowerGeneration,
  },
  {
    index: '02',
    title: 'Engine Room Electrical',
    blurb:
      'Group starter panels for purifiers, compressors, boiler and ventilation, earth-fault monitoring, shaft earthing and insulation records.',
    // Auxiliaries — purifiers, compressors, boiler — on the engine room side
    // flats, so offset off the centreline.
    anchor: new THREE.Vector3(-42, -6, -3),
    // Lifted, and shifted toward screen-right. The shift is carried on Z
    // rather than X because at this point in the sweep the camera is still
    // about 49deg off the beam, so +Z is most of what "right" means on screen
    // — and moving X here would push past the next system and make the camera
    // double back.
    focus: new THREE.Vector3(-42, -2, 2),
    at: 0.2,
    Diagram: EngineRoomElectrical,
  },
  {
    index: '03',
    title: 'Power Distribution',
    blurb:
      'Main and emergency switchboards, feeder coordination, transformers for 220V services, insulation monitoring and selective protection.',
    // Main switchboard lives in the engine control room — top engine room
    // flat, just under the main deck, offset to one side as it usually is.
    anchor: new THREE.Vector3(-40, -4, 3),
    at: 0.3,
    Diagram: PowerDistribution,
  },
  {
    index: '04',
    title: 'Automation & Control',
    blurb:
      'PLC and UMS systems, field instrumentation, loop tuning, alarm and monitoring extension to the bridge, watchcall and event logging.',
    // UMS consoles share the engine control room with the switchboard, a deck
    // higher — at main deck level in the lowest tier of the accommodation.
    anchor: new THREE.Vector3(-39, -1, 3),
    at: 0.4,
    Diagram: AutomationControl,
  },
  {
    index: '05',
    title: 'Lighting & Accommodation',
    blurb:
      'Normal and emergency lighting circuits, automatic changeover, navigation light panels with per-circuit failure alarm, hotel load boards.',
    // Marker moved forward along the block so it and its label sit further
    // right on screen. The camera is beam-on by this point, so +X is exactly
    // screen-right.
    anchor: new THREE.Vector3(-33, 4, 0),
    // Camera deliberately left where it was — this is the marker moving, not
    // the shot.
    focus: new THREE.Vector3(-38, 4, 0),
    at: 0.5,
    Diagram: LightingAccommodation,
  },
  {
    index: '06',
    title: 'Navigation & Communication',
    blurb:
      'Radar, GNSS, AIS, VDR and GMDSS installations, gyro and autopilot interfacing, redundant supplies and annual radio survey support.',
    // Wheelhouse at the top of the block, with the radar mast above it.
    anchor: new THREE.Vector3(-37, 9, 0),
    at: 0.6,
    Diagram: NavigationComms,
  },
  {
    index: '07',
    title: 'Safety Systems',
    blurb:
      'Addressable fire detection loops, general alarm, emergency stops for fuel and ventilation, bilge alarms and emergency lighting integrity.',
    // Fire control station and muster point: on the main deck immediately
    // forward of the accommodation, which is where they are on this ship type.
    anchor: new THREE.Vector3(-28, -3, 0),
    at: 0.7,
    Diagram: SafetySystems,
  },
  {
    index: '08',
    title: 'Cargo Electrical Systems',
    blurb:
      'Deck ring main, crane and hatch cover drives, hold ventilation and bilge monitoring, cargo console instrumentation.',
    // A deck crane pedestal amidships. Cranes on a geared bulk carrier stand
    // on the centreline between hatches, which is why Z is 0.
    anchor: new THREE.Vector3(12, 2, 0),
    at: 0.8,
    Diagram: CargoSystems,
  },
  {
    index: '09',
    title: 'Electric Motors & Drives',
    blurb:
      'Starters from direct-on-line to frequency converters, overload and phase-failure protection, alignment, rewinding and bearing condition work.',
    // Bow thruster room, forward and below the waterline (-9) — the largest
    // single motor on the ship and the one furthest from the switchboard.
    anchor: new THREE.Vector3(44, -8, 0),
    at: 0.9,
    Diagram: MotorsAndDrives,
  },
]

/** Half-width of a system's scroll window. */
const HALF = 0.05
/** How much of that half is spent fading rather than held. */
const FADE = 0.03

/**
 * How present a system is at this scroll position, 0..1.
 *
 * Shared by the 3D node and the DOM panel deliberately — if they computed
 * their own, the marker and its diagram could drift out of step, which is
 * exactly the kind of mismatch nobody notices until it looks subtly wrong.
 */
export function systemActivity(p: number, at: number): number {
  return (
    THREE.MathUtils.smoothstep(p, at - HALF, at - HALF + FADE) *
    (1 - THREE.MathUtils.smoothstep(p, at + HALF - FADE, at + HALF))
  )
}

/**
 * The company intro occupies the first stop, before any system.
 *
 * It holds full until the scroll leaves the opening frame, then clears well
 * before system 01 fades in — the two must never be on screen together, or the
 * hero statement and a single-line diagram compete for the same attention.
 * System 01 starts appearing at 0.05 (its centre 0.10 less the half-window),
 * so this is finished by then.
 */
const INTRO_HOLD = 0.012
const INTRO_GONE = 0.045

export function introActivity(p: number): number {
  return 1 - THREE.MathUtils.smoothstep(p, INTRO_HOLD, INTRO_GONE)
}

/** Where the camera looks before the first system takes over. Amidships, so
    the opening frame is composed on the whole vessel rather than on a detail. */
const OPENING_FOCUS = new THREE.Vector3(0, 0, 0)

/**
 * The point on the vessel the camera should be looking at, for this scroll
 * position — a path running amidships → system 01 → 02 → … → 09.
 *
 * Each leg eases with smoothstep, so the camera SETTLES on a system at its
 * scroll centre rather than sweeping past it. That is what ties the camera to
 * the annotation: when a node is fully lit, the camera is exactly on it.
 *
 * Writes into `out` rather than returning a new vector — this runs every
 * frame, and allocating a Vector3 per frame is how you get GC sawtooth in an
 * otherwise smooth animation.
 */
export function focusTarget(p: number, out: THREE.Vector3): THREE.Vector3 {
  const first = SYSTEMS[0]
  if (p <= first.at) {
    return out.copy(OPENING_FOCUS).lerp(focusOf(first), THREE.MathUtils.smoothstep(p, 0, first.at))
  }

  for (let i = 0; i < SYSTEMS.length - 1; i++) {
    const a = SYSTEMS[i]
    const b = SYSTEMS[i + 1]
    if (p <= b.at) {
      return out.copy(focusOf(a)).lerp(focusOf(b), THREE.MathUtils.smoothstep(p, a.at, b.at))
    }
  }

  return out.copy(focusOf(SYSTEMS[SYSTEMS.length - 1]))
}

/** The system most present right now, and by how much. */
export function dominantSystem(p: number): { index: number; activity: number } {
  let index = -1
  let activity = 0
  for (let i = 0; i < SYSTEMS.length; i++) {
    const a = systemActivity(p, SYSTEMS[i].at)
    if (a > activity) {
      activity = a
      index = i
    }
  }
  return { index, activity }
}
