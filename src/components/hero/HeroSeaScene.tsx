import { useId } from 'react'

/**
 * Top-down general-arrangement plan of a geared bulk carrier under way —
 * drawn to read like a working drawing, not clipart.
 *
 * ---------------------------------------------------------------------------
 * Rendered as three stacked layers. The split is what keeps it at 60fps:
 *
 *   1. SEA — `preserveAspectRatio="none"`, so the water stretches to both
 *      screen edges at any aspect ratio. Waves translate; each is promoted
 *      with will-change so the compositor moves them instead of repainting.
 *   2. WASH — `meet`, holds everything the hull disturbs (displacement
 *      shading, propeller wash, bow wave, side foam). Does NOT heave: a wake
 *      is left behind in the water, it doesn't roll with the ship.
 *   3. SHIP — `meet`, wrapped in a div that carries the heave animation.
 *
 * Three rules are load-bearing for performance here. Breaking any of them
 * brings the stutter straight back:
 *
 *   - The heave lives on the HTML wrapper, never on an SVG <g>. SVG element
 *     transforms are not composited — they repaint the entire subtree (~300
 *     nodes) every frame. A div transform is handed to the compositor.
 *   - Nothing inside a moving layer gets an feGaussianBlur over a large area.
 *     A filtered element that moves is re-filtered per frame; the hull shadow
 *     used to be a σ=12 blur over the whole hull (~750k px re-blurred at
 *     60fps) and was single-handedly blowing the frame budget. It is now a
 *     static radial-gradient ellipse in the wash layer, which costs nothing.
 *     The node glows keep their blur because their filter regions are ~20px
 *     square — negligible, and they read better than layered circles.
 *   - Dash flow is a transform of exactly one dash period, never a
 *     stroke-dashoffset animation. dashoffset can't be composited and
 *     regenerates the dash geometry every frame. It also has to divide evenly
 *     into the period or the dashes visibly jump on each repeat, which is
 *     easy to get wrong; a one-period translate is seamless by construction.
 *     Streaks that aren't axis-aligned are pre-rotated (see WAKE) so their
 *     flow is still a plain translate.
 *
 * Nothing here fades to zero and restarts — every loop either translates by a
 * whole period or uses `alternate`. An opacity that pops back to full reads as
 * stutter just as much as a dropped frame does.
 * ---------------------------------------------------------------------------
 *
 * Everything is SVG rather than a GIF or video: sharp at any density, a few
 * KB gzipped, recolourable from the brand tokens, and it honours
 * prefers-reduced-motion (killed globally in index.css).
 *
 * Conventions:
 *   - Bow to the right, transom to the left; centreline at y = CL.
 *   - All three layers share one viewBox, so coordinates line up across them.
 *   - Below-waterline items (shaft, propeller, rudder, bulbous bow, thruster
 *     tunnel) are dashed at low opacity — hidden detail, as on a real GA.
 *   - Port side is the top of the drawing.
 *   - The finest annotations (frame numbers, dimensions, bollards, callouts)
 *     are gated behind `md`/`lg`; at phone width they would be noise.
 */

const VIEW_W = 1200
const VIEW_H = 700

/** Centreline and principal dimensions, in view-box units. */
const CL = 350
const STERN_X = 172
const BOW_X = 1064
const HALF_BEAM = 100

/** Waves repeat every 240px so a -240px translate loops seamlessly. */
function wavePath(y: number, amplitude: number): string {
  const seg = 120
  const start = -240
  const end = VIEW_W + 240
  let d = `M ${start} ${y} q ${seg / 2} ${-amplitude} ${seg} 0`
  for (let x = start + seg; x < end; x += seg) d += ` t ${seg} 0`
  return d
}

const WAVES = [
  { y: 56, amplitude: 9, opacity: 0.13, duration: 13 },
  { y: 128, amplitude: 12, opacity: 0.17, duration: 10 },
  { y: 196, amplitude: 8, opacity: 0.11, duration: 16 },
  { y: 508, amplitude: 11, opacity: 0.15, duration: 11 },
  { y: 576, amplitude: 9, opacity: 0.12, duration: 14 },
  { y: 648, amplitude: 13, opacity: 0.09, duration: 9 },
]

/**
 * Hull outline. Rounded transom aft, parallel midbody, waterline entry
 * flaring to a fine stem at the bow.
 */
const HULL_PATH = `
  M 212 ${CL - HALF_BEAM}
  L 842 ${CL - HALF_BEAM}
  C 924 ${CL - HALF_BEAM + 3}, 990 ${CL - 64}, 1040 ${CL - 28}
  Q 1058 ${CL - 14}, ${BOW_X} ${CL}
  Q 1058 ${CL + 14}, 1040 ${CL + 28}
  C 990 ${CL + 64}, 924 ${CL + HALF_BEAM - 3}, 842 ${CL + HALF_BEAM}
  L 212 ${CL + HALF_BEAM}
  C 190 ${CL + HALF_BEAM}, ${STERN_X} ${CL + 70}, ${STERN_X} ${CL}
  C ${STERN_X} ${CL - 70}, 190 ${CL - HALF_BEAM}, 212 ${CL - HALF_BEAM}
  Z
`

/** Bulwark / sheer strake, inset 7 from the deck edge. */
const BULWARK_PATH = `
  M 216 ${CL - HALF_BEAM + 7}
  L 840 ${CL - HALF_BEAM + 7}
  C 918 ${CL - HALF_BEAM + 10}, 982 ${CL - 60}, 1030 ${CL - 25}
  Q 1048 ${CL - 12}, 1054 ${CL}
  Q 1048 ${CL + 12}, 1030 ${CL + 25}
  C 982 ${CL + 60}, 918 ${CL + HALF_BEAM - 10}, 840 ${CL + HALF_BEAM - 7}
  L 216 ${CL + HALF_BEAM - 7}
  C 198 ${CL + HALF_BEAM - 7}, 180 ${CL + 64}, 180 ${CL}
  C 180 ${CL - 64}, 198 ${CL - HALF_BEAM + 7}, 216 ${CL - HALF_BEAM + 7}
  Z
`

/** Five cargo holds. No.1 hold is at the bow, so numbering runs 5→1. */
const HATCH_PITCH = 96
const HATCH_W = 64
const HATCHES = [0, 1, 2, 3, 4].map((i) => ({
  key: i,
  x: 392 + i * HATCH_PITCH,
  holdNo: 5 - i,
}))

/** Four deck cranes in the cross-decks between coamings, jibs alternating. */
const CRANES = [0, 1, 2, 3].map((i) => ({
  key: i,
  x: 472 + i * HATCH_PITCH,
  toPort: i % 2 === 0,
}))

/** Systems we service, each with an explicit callout anchor. */
const NODES = [
  { x: 262, y: 328, label: 'BRIDGE / NAV', labelX: 190, labelY: 168, delay: 0 },
  { x: 306, y: 306, label: 'MAIN SWITCHBOARD', labelX: 400, labelY: 120, delay: 1.4 },
  { x: 296, y: 392, label: 'ENGINE ROOM · UMS', labelX: 372, labelY: 560, delay: 2.6 },
  { x: 186, y: 350, label: 'STEERING GEAR', labelX: 130, labelY: 590, delay: 0.7 },
  { x: 568, y: 350, label: 'DECK CRANES', labelX: 620, labelY: 128, delay: 3.3 },
  { x: 712, y: 358, label: 'BALLAST', labelX: 740, labelY: 566, delay: 2.0 },
  { x: 992, y: 350, label: 'BOW THRUSTER', labelX: 1024, labelY: 176, delay: 4.0 },
]

/**
 * Propeller wash. Each streak is pre-rotated so its dash flow becomes a plain
 * translate along the line's own axis — see the dash-flow note at the top.
 * `head` runs forward of the origin, under the opaque hull, so translating by
 * one dash period never uncovers the end of the line.
 */
const WAKE_HEAD = -96
const WAKE = [310, 330, 350, 370, 390].map((y, i) => {
  const dx = -710
  const dy = (y - CL) * 3.6
  return {
    y,
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    len: Math.hypot(dx, dy),
    strokeWidth: i === 2 ? 2 : 1.4,
    duration: 3 + i * 0.35,
  }
})

/** Mooring bollard pairs down both sides of the weather deck. */
const BOLLARDS = [244, 360, 480, 600, 720, 832, 906, 964]

/** Fairleads at the deck edge, roughly amidships of each mooring station. */
const FAIRLEADS = [300, 550, 780, 940]

const line = 'var(--color-signal-500)'
const lineBright = 'var(--color-signal-400)'
const lineDim = 'var(--color-signal-600)'

export function HeroSeaScene({ label }: { label: string }) {
  // Ids must be unique per instance or a second mount would steal the defs.
  const uid = useId().replace(/:/g, '')
  const seaId = `sea-${uid}`
  const deepId = `deep-${uid}`
  const shadowId = `shadow-${uid}`
  const wakeId = `wake-${uid}`
  const hullId = `hull-${uid}`
  const glowId = `glow-${uid}`

  return (
    <div className="bg-navy-950 relative h-full w-full overflow-hidden">
      {/* ---------------- 1. Sea: full bleed ---------------- */}
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={seaId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-navy-950)" />
            <stop offset="35%" stopColor="var(--color-navy-900)" />
            <stop offset="65%" stopColor="var(--color-navy-900)" />
            <stop offset="100%" stopColor="var(--color-navy-950)" />
          </linearGradient>
        </defs>

        <rect width={VIEW_W} height={VIEW_H} fill={`url(#${seaId})`} />

        {/* Wave lines drifting to port, each at its own rate for depth */}
        {WAVES.map((wave) => (
          <path
            key={wave.y}
            d={wavePath(wave.y, wave.amplitude)}
            fill="none"
            stroke={line}
            strokeWidth="1.5"
            strokeOpacity={wave.opacity}
            style={{
              animation: `ima-swell-x ${wave.duration}s linear infinite`,
              willChange: 'transform',
            }}
          />
        ))}

        {/* Slow survey sweep across the frame */}
        <rect
          x="-160"
          y="0"
          width="160"
          height={VIEW_H}
          fill={lineBright}
          fillOpacity="0.05"
          style={{ animation: 'ima-scan 9s 2s linear infinite', willChange: 'transform' }}
        />
      </svg>

      {/* ---------------- 2. Wash: what the hull leaves in the water ---------------- */}
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          {/* Displaced water around the hull */}
          <radialGradient id={deepId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-navy-950)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--color-navy-950)" stopOpacity="0" />
          </radialGradient>
          {/* Hull shadow. A gradient, not a blur filter — see the note up top. */}
          <radialGradient id={shadowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="black" stopOpacity="0.55" />
            <stop offset="55%" stopColor="black" stopOpacity="0.4" />
            <stop offset="100%" stopColor="black" stopOpacity="0" />
          </radialGradient>
          {/* Wash fades out astern. Resolved in each streak's own rotated
              space, so one gradient serves all five. This replaces an opacity
              animation that popped back to full on every repeat. */}
          <linearGradient id={wakeId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="740" y2="0">
            <stop offset="0%" stopColor="var(--color-signal-400)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--color-signal-400)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <ellipse cx="618" cy={CL + 30} rx="520" ry="150" fill={`url(#${deepId})`} />
        <ellipse cx="626" cy={CL + 22} rx="450" ry="86" fill={`url(#${shadowId})`} />

        {/* Propeller wash: turbulent V spreading astern, running past the
            viewBox so it reaches the screen edge on wide displays. */}
        {WAKE.map((streak) => (
          <g key={streak.y} transform={`translate(150 ${streak.y}) rotate(${streak.angle})`}>
            <g
              style={{
                animation: `ima-flow-aft-32 ${streak.duration}s linear infinite`,
                willChange: 'transform',
              }}
            >
              <line
                x1={WAKE_HEAD}
                y1="0"
                x2={streak.len}
                y2="0"
                stroke={`url(#${wakeId})`}
                strokeWidth={streak.strokeWidth}
                strokeDasharray="12 20"
              />
            </g>
          </g>
        ))}

        {/* Bow wave: crests peeling off both sides of the stem. A bow wave
            stands still relative to the hull, so these don't flow — they only
            breathe, which costs nothing and can't pop. */}
        <g
          fill="none"
          stroke="var(--color-signal-300)"
          style={{ animation: 'ima-breathe 4s ease-in-out infinite alternate' }}
        >
          {[
            `M ${BOW_X - 2} ${CL - 6} C 1010 ${CL - 78}, 920 ${CL - 118}, 800 ${CL - 138}`,
            `M ${BOW_X - 2} ${CL + 6} C 1010 ${CL + 78}, 920 ${CL + 118}, 800 ${CL + 138}`,
            `M ${BOW_X - 14} ${CL - 10} C 1000 ${CL - 60}, 930 ${CL - 88}, 850 ${CL - 102}`,
            `M ${BOW_X - 14} ${CL + 10} C 1000 ${CL + 60}, 930 ${CL + 88}, 850 ${CL + 102}`,
          ].map((d, i) => (
            <path key={d} d={d} strokeWidth={i < 2 ? 1.8 : 1.2} strokeDasharray="10 14" />
          ))}
        </g>

        {/* Foam streaming down both sides of the hull, out to both screen edges */}
        <g
          stroke="var(--color-signal-300)"
          strokeOpacity="0.25"
          style={{ animation: 'ima-flow-aft-80 1.8s linear infinite', willChange: 'transform' }}
        >
          {[CL - HALF_BEAM - 10, CL + HALF_BEAM + 10].map((y) => (
            <line key={y} x1="-640" y1={y} x2="1840" y2={y} strokeWidth="2" strokeDasharray="18 62" />
          ))}
        </g>
      </svg>

      {/* ---------------- 3. Ship ----------------
          The heave rides on this div, not on a <g> inside the SVG, so the
          whole vessel rasterises once and the compositor moves it. */}
      <div
        className="absolute inset-0"
        style={{
          animation: 'ima-heave 7s ease-in-out infinite',
          transformOrigin: 'center',
          willChange: 'transform',
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          role="img"
          aria-label={label}
        >
          <defs>
            <linearGradient id={hullId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-navy-700)" />
              <stop offset="18%" stopColor="var(--color-navy-800)" />
              <stop offset="50%" stopColor="var(--color-navy-900)" />
              <stop offset="82%" stopColor="var(--color-navy-800)" />
              <stop offset="100%" stopColor="var(--color-navy-700)" />
            </linearGradient>

            {/* Filter region is ~20px square per node — cheap enough to move. */}
            <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ---- Below the waterline: drawn as hidden detail ---- */}
          <g stroke={line} fill="none" strokeOpacity="0.38" strokeDasharray="5 4">
            {/* Rudder blade behind the propeller */}
            <rect x="104" y="337" width="48" height="26" rx="11" strokeWidth="1.4" />
            <line x1="128" y1="337" x2="128" y2="363" strokeWidth="1" />
            {/* Propeller: disc, hub, four blades */}
            <circle cx="164" cy={CL} r="27" strokeWidth="1.4" />
            <circle cx="164" cy={CL} r="5" strokeWidth="1" />
            {[0, 45, 90, 135].map((angle) => (
              <ellipse
                key={angle}
                cx="164"
                cy={CL}
                rx="25"
                ry="7"
                strokeWidth="1"
                transform={`rotate(${angle} 164 ${CL})`}
              />
            ))}
            {/* Tail shaft and intermediate shaft bearings into the engine room */}
            <line x1="164" y1={CL} x2="340" y2={CL} strokeWidth="1.6" />
            {[220, 275].map((x) => (
              <rect key={x} x={x - 5} y={CL - 6} width="10" height="12" strokeWidth="1" />
            ))}
            {/* Bilge keels along the turn of the bilge */}
            <line x1="430" y1={CL - HALF_BEAM - 14} x2="790" y2={CL - HALF_BEAM - 14} strokeWidth="1.2" />
            <line x1="430" y1={CL + HALF_BEAM + 14} x2="790" y2={CL + HALF_BEAM + 14} strokeWidth="1.2" />
            {/* Bulbous bow */}
            <ellipse cx="1042" cy={CL} rx="36" ry="26" strokeWidth="1.4" />
            <line x1="1006" y1={CL} x2="1078" y2={CL} strokeWidth="1" />
            {/* Bow thruster tunnel */}
            <circle cx="992" cy={CL} r="19" strokeWidth="1.4" />
            <line x1="992" y1={CL - 19} x2="992" y2={CL + 19} strokeWidth="1" />
          </g>

          {/* ---- Hull ---- */}
          <path d={HULL_PATH} fill={`url(#${hullId})`} stroke={lineBright} strokeWidth="2.2" strokeOpacity="0.95" />
          <path d={BULWARK_PATH} fill="none" stroke={line} strokeWidth="1" strokeOpacity="0.4" />

          {/* Deck plating seams */}
          {[CL - 72, CL - 36, CL + 36, CL + 72].map((y) => (
            <line key={y} x1="214" y1={y} x2="900" y2={y} stroke={line} strokeWidth="1" strokeOpacity="0.1" />
          ))}
          {/* Centreline: long-dash-dot, the way a CL is actually drawn */}
          <line
            x1={STERN_X}
            y1={CL}
            x2={BOW_X}
            y2={CL}
            stroke={line}
            strokeWidth="1"
            strokeOpacity="0.32"
            strokeDasharray="16 5 3 5"
          />

          {/* Frame stations, heavier line + number every fourth */}
          <g className="hidden md:block">
            {Array.from({ length: 21 }, (_, i) => ({ i, x: 224 + i * 40 })).map(({ i, x }) => (
              <g key={x}>
                <line
                  x1={x}
                  y1={CL - HALF_BEAM + 8}
                  x2={x}
                  y2={CL + HALF_BEAM - 8}
                  stroke={line}
                  strokeWidth="1"
                  strokeOpacity={i % 4 === 0 ? 0.2 : 0.08}
                />
                {i % 4 === 0 && (
                  <text
                    x={x}
                    y={CL + HALF_BEAM - 14}
                    textAnchor="middle"
                    fill={line}
                    fillOpacity="0.35"
                    className="font-mono"
                    style={{ fontSize: '8px' }}
                  >
                    {i * 5}
                  </text>
                )}
              </g>
            ))}
          </g>

          {/* Guard rails: stanchion dots just inside the deck edge */}
          <g className="hidden md:block" fill={line} fillOpacity="0.25">
            {Array.from({ length: 34 }, (_, i) => 230 + i * 20).map((x) => (
              <g key={x}>
                <circle cx={x} cy={CL - HALF_BEAM + 4} r="1.2" />
                <circle cx={x} cy={CL + HALF_BEAM - 4} r="1.2" />
              </g>
            ))}
          </g>

          {/* ---- Stern deck: mooring gear ---- */}
          <g stroke={lineBright} strokeOpacity="0.55" fill="var(--color-navy-700)">
            {/* Mooring winches port & starboard */}
            <rect x="196" y="276" width="34" height="18" rx="3" strokeWidth="1.2" />
            <rect x="196" y="406" width="34" height="18" rx="3" strokeWidth="1.2" />
            {/* Warping drums */}
            <circle cx="205" cy="285" r="5" fill="var(--color-navy-950)" strokeWidth="1" />
            <circle cx="205" cy="415" r="5" fill="var(--color-navy-950)" strokeWidth="1" />
          </g>
          {/* Free-fall lifeboat on its stern ramp, angled aft over the transom */}
          <g transform={`translate(176 ${CL}) rotate(180)`}>
            <path
              d="M 0 -8 L 26 -8 Q 40 0 26 8 L 0 8 Z"
              fill="var(--color-navy-600)"
              fillOpacity="0.5"
              stroke={lineBright}
              strokeWidth="1.3"
              strokeOpacity="0.7"
            />
            <line x1="4" y1="0" x2="30" y2="0" stroke={line} strokeWidth="0.8" strokeOpacity="0.5" />
          </g>

          {/* ---- Accommodation block: five stepped decks up to the wheelhouse ---- */}
          <g stroke={lineBright} strokeOpacity="0.65">
            <rect x="196" y="262" width="142" height="176" rx="4" strokeWidth="1.5" fill="var(--color-navy-800)" />
            <rect x="208" y="276" width="120" height="148" rx="3" strokeWidth="1.1" fill="var(--color-navy-800)" fillOpacity="0.9" />
            <rect x="220" y="290" width="98" height="120" rx="3" strokeWidth="1.1" fill="var(--color-navy-700)" fillOpacity="0.6" />
            <rect x="232" y="304" width="76" height="92" rx="2" strokeWidth="1.1" fill="var(--color-navy-700)" fillOpacity="0.8" />
            {/* Wheelhouse, forward face toward the bow */}
            <rect x="244" y="316" width="54" height="68" rx="2" strokeWidth="1.4" fill="var(--color-navy-600)" fillOpacity="0.4" />
          </g>
          {/* Wheelhouse windows: ticks along the forward face */}
          <g stroke="var(--color-signal-300)" strokeOpacity="0.55" strokeWidth="1.4">
            {[322, 331, 340, 349, 358, 367, 376].map((y) => (
              <line key={y} x1="296" y1={y} x2="301" y2={y} />
            ))}
          </g>

          {/* Bridge wings spanning the full beam */}
          {[CL - HALF_BEAM, CL + HALF_BEAM - 12].map((y) => (
            <rect
              key={y}
              x="252"
              y={y}
              width="38"
              height="12"
              rx="2"
              fill="var(--color-signal-600)"
              fillOpacity="0.4"
              stroke={lineBright}
              strokeWidth="1"
              strokeOpacity="0.55"
            />
          ))}

          {/* Radar mast on top of the wheelhouse, antenna sweeping */}
          <g>
            <circle cx="270" cy={CL} r="9" fill="var(--color-navy-950)" stroke={lineBright} strokeWidth="1.3" strokeOpacity="0.7" />
            <g
              style={{
                animation: 'ima-radar 4s linear infinite',
                transformOrigin: `270px ${CL}px`,
                transformBox: 'view-box',
              }}
            >
              <line x1="270" y1={CL} x2="294" y2={CL} stroke="var(--color-signal-300)" strokeWidth="1.6" strokeOpacity="0.8" />
            </g>
            {/* Stay wires */}
            {[
              [252, CL - 14],
              [252, CL + 14],
              [288, CL - 14],
              [288, CL + 14],
            ].map(([x, y]) => (
              <line key={`${x}-${y}`} x1="270" y1={CL} x2={x} y2={y} stroke={line} strokeWidth="0.7" strokeOpacity="0.35" />
            ))}
          </g>

          {/* Funnel with uptakes, aft of the wheelhouse */}
          <g>
            <rect x="206" y="326" width="34" height="48" rx="6" fill="var(--color-navy-700)" stroke={lineBright} strokeWidth="1.5" strokeOpacity="0.75" />
            <rect x="210" y="330" width="26" height="40" rx="4" fill="none" stroke={line} strokeWidth="0.8" strokeOpacity="0.4" />
            {[340, 360].map((cy) => (
              <circle key={cy} cx="223" cy={cy} r="6" fill="var(--color-navy-950)" stroke={line} strokeWidth="1" strokeOpacity="0.6" />
            ))}
          </g>

          {/* Lifeboats on davits, port & starboard of the accommodation */}
          {[250, 450].map((cy) => (
            <g key={cy}>
              <ellipse
                cx="264"
                cy={cy}
                rx="32"
                ry="10"
                fill="var(--color-navy-600)"
                fillOpacity="0.55"
                stroke={lineBright}
                strokeWidth="1.3"
                strokeOpacity="0.7"
              />
              <line x1="264" y1={cy - 10} x2="264" y2={cy + 10} stroke={line} strokeWidth="0.8" strokeOpacity="0.5" />
              {/* Davit arms back to the boat deck */}
              {[246, 282].map((x) => (
                <line
                  key={x}
                  x1={x}
                  y1={cy}
                  x2={x}
                  y2={cy < CL ? 268 : 432}
                  stroke={line}
                  strokeWidth="1"
                  strokeOpacity="0.4"
                />
              ))}
            </g>
          ))}

          {/* Life raft canisters just forward of the boats */}
          <g className="hidden md:block" fill="var(--color-navy-600)" stroke={line} strokeOpacity="0.5" strokeWidth="1">
            <circle cx="322" cy={CL - HALF_BEAM + 16} r="5" />
            <circle cx="322" cy={CL + HALF_BEAM - 16} r="5" />
          </g>

          {/* Engine room casing below deck (hidden detail) */}
          <rect
            x="246"
            y="300"
            width="96"
            height="100"
            rx="4"
            fill="none"
            stroke={line}
            strokeWidth="1.1"
            strokeOpacity="0.3"
            strokeDasharray="6 5"
          />

          {/* ---- Cargo holds ---- */}
          {HATCHES.map((hatch) => (
            <g key={hatch.key}>
              {/* Coaming */}
              <rect
                x={hatch.x}
                y="284"
                width={HATCH_W}
                height="132"
                rx="3"
                fill="var(--color-navy-800)"
                stroke={line}
                strokeWidth="1.5"
                strokeOpacity="0.6"
              />
              {/* Hatch cover, slightly proud and lighter — steel in the sun */}
              <rect
                x={hatch.x + 5}
                y="290"
                width={HATCH_W - 10}
                height="120"
                rx="2"
                fill="var(--color-navy-700)"
                fillOpacity="0.55"
                stroke={line}
                strokeWidth="1"
                strokeOpacity="0.35"
              />
              {/* Longitudinal joint between the two folding pairs */}
              <line
                x1={hatch.x + HATCH_W / 2}
                y1="290"
                x2={hatch.x + HATCH_W / 2}
                y2="410"
                stroke={line}
                strokeWidth="1"
                strokeOpacity="0.3"
              />
              {/* Cross joints between panels */}
              {[1, 2, 3].map((p) => (
                <line
                  key={p}
                  x1={hatch.x + 5}
                  y1={290 + p * 30}
                  x2={hatch.x + HATCH_W - 5}
                  y2={290 + p * 30}
                  stroke={line}
                  strokeWidth="1"
                  strokeOpacity="0.22"
                />
              ))}
              {/* Cleats along the coaming sides */}
              <g className="hidden md:block" fill={line} fillOpacity="0.3">
                {[300, 330, 360, 390].map((y) => (
                  <g key={y}>
                    <rect x={hatch.x - 3} y={y} width="3" height="6" />
                    <rect x={hatch.x + HATCH_W} y={y} width="3" height="6" />
                  </g>
                ))}
              </g>
              {/* Hold number */}
              <text
                x={hatch.x + HATCH_W / 2}
                y={CL + 3}
                textAnchor="middle"
                fill={lineBright}
                fillOpacity="0.4"
                className="hidden font-mono md:block"
                style={{ fontSize: '9px', letterSpacing: '0.08em' }}
              >
                NO.{hatch.holdNo}
              </text>
            </g>
          ))}

          {/* ---- Deck cranes ---- */}
          {CRANES.map((crane) => {
            const dir = crane.toPort ? -1 : 1
            const tipX = crane.x + 30
            const tipY = CL + dir * 126
            return (
              <g key={crane.key}>
                {/* Jib: two chords converging to the head, like a real lattice boom */}
                <line x1={crane.x - 4} y1={CL + dir * 8} x2={tipX} y2={tipY} stroke={lineBright} strokeWidth="1.6" strokeOpacity="0.55" strokeLinecap="round" />
                <line x1={crane.x + 8} y1={CL + dir * 4} x2={tipX} y2={tipY} stroke={lineBright} strokeWidth="1.6" strokeOpacity="0.55" strokeLinecap="round" />
                {/* Hoist wire and hook below the jib head */}
                <line x1={tipX} y1={tipY} x2={tipX} y2={tipY + dir * 14} stroke={line} strokeWidth="1" strokeOpacity="0.5" />
                <circle cx={tipX} cy={tipY + dir * 17} r="2.5" fill="none" stroke={lineBright} strokeWidth="1.2" strokeOpacity="0.6" />
                {/* Counterweight / machinery house opposite the jib */}
                <rect
                  x={crane.x - 9}
                  y={CL - dir * 30 - (crane.toPort ? 0 : 18)}
                  width="18"
                  height="18"
                  rx="2"
                  fill="var(--color-navy-700)"
                  stroke={lineBright}
                  strokeWidth="1.1"
                  strokeOpacity="0.5"
                />
                {/* Pedestal and slew ring */}
                <circle cx={crane.x} cy={CL} r="15" fill="var(--color-navy-700)" stroke={lineBright} strokeWidth="1.5" strokeOpacity="0.8" />
                <circle cx={crane.x} cy={CL} r="9" fill="none" stroke={line} strokeWidth="0.8" strokeOpacity="0.45" />
                <circle cx={crane.x} cy={CL} r="4" fill="var(--color-navy-950)" stroke={line} strokeWidth="1" strokeOpacity="0.55" />
              </g>
            )
          })}

          {/* ---- Forecastle ---- */}
          {/* Forecastle break */}
          <line x1="892" y1={CL - 86} x2="892" y2={CL + 86} stroke={line} strokeWidth="1.4" strokeOpacity="0.4" />
          <path
            d="M 892 272 C 944 288, 984 314, 1014 350 C 984 386, 944 412, 892 428 Z"
            fill="var(--color-navy-800)"
            fillOpacity="0.6"
            stroke={line}
            strokeWidth="1.2"
            strokeOpacity="0.45"
          />
          {/* Windlasses port & starboard with gypsy wheels */}
          {[-1, 1].map((dir) => (
            <g key={dir}>
              <rect
                x="912"
                y={CL + dir * 22 - 9}
                width="30"
                height="18"
                rx="3"
                fill="var(--color-navy-700)"
                stroke={lineBright}
                strokeWidth="1.2"
                strokeOpacity="0.65"
              />
              <circle cx="920" cy={CL + dir * 22} r="4" fill="var(--color-navy-950)" stroke={line} strokeWidth="1" strokeOpacity="0.6" />
              {/* Chain from gypsy to hawse pipe: stud-link drawn as tight dashes */}
              <path
                d={`M 942 ${CL + dir * 22} C 962 ${CL + dir * 28}, 976 ${CL + dir * 36}, 988 ${CL + dir * 46}`}
                fill="none"
                stroke={lineBright}
                strokeWidth="2.2"
                strokeOpacity="0.5"
                strokeDasharray="3 2.5"
              />
              {/* Hawse pipe */}
              <circle cx="991" cy={CL + dir * 49} r="5.5" fill="var(--color-navy-950)" stroke={lineBright} strokeWidth="1.3" strokeOpacity="0.65" />
              {/* Chain stopper on deck */}
              <rect x="958" y={CL + dir * 33 - 3} width="8" height="6" fill={line} fillOpacity="0.35" />
            </g>
          ))}
          {/* Spurling pipes to the chain locker, centreline */}
          <circle cx="928" cy={CL} r="4" fill="none" stroke={line} strokeWidth="1" strokeOpacity="0.4" strokeDasharray="2 2" />

          {/* Foremast with stays */}
          <g stroke={lineBright} strokeOpacity="0.6" fill="none">
            <circle cx="972" cy={CL} r="7" strokeWidth="1.4" />
            <line x1="956" y1={CL} x2="988" y2={CL} strokeWidth="0.9" strokeOpacity="0.5" />
            <line x1="972" y1={CL - 16} x2="972" y2={CL + 16} strokeWidth="0.9" strokeOpacity="0.5" />
          </g>
          {/* Panama chock at the stem */}
          <ellipse cx="1052" cy={CL} rx="6" ry="4" fill="none" stroke={lineBright} strokeWidth="1.2" strokeOpacity="0.6" />

          {/* Mooring bollards: paired bitts both sides */}
          <g className="hidden md:block" fill={line} fillOpacity="0.42">
            {BOLLARDS.map((x) => (
              <g key={x}>
                <circle cx={x} cy={CL - HALF_BEAM + 13} r="2.6" />
                <circle cx={x + 8} cy={CL - HALF_BEAM + 13} r="2.6" />
                <circle cx={x} cy={CL + HALF_BEAM - 13} r="2.6" />
                <circle cx={x + 8} cy={CL + HALF_BEAM - 13} r="2.6" />
              </g>
            ))}
          </g>
          {/* Fairleads let into the bulwark */}
          <g className="hidden md:block" fill="none" stroke={line} strokeOpacity="0.4" strokeWidth="1.2">
            {FAIRLEADS.map((x) => (
              <g key={x}>
                <rect x={x} y={CL - HALF_BEAM + 1} width="14" height="5" rx="2.5" />
                <rect x={x} y={CL + HALF_BEAM - 6} width="14" height="5" rx="2.5" />
              </g>
            ))}
          </g>

          {/* Fire main + deck vents down both sides */}
          {[CL - 80, CL + 80].map((y) => (
            <line key={y} x1="348" y1={y} x2="888" y2={y} stroke={line} strokeWidth="1" strokeOpacity="0.16" strokeDasharray="10 5" />
          ))}
          <g className="hidden md:block" fill="none" stroke={line} strokeOpacity="0.35" strokeWidth="1">
            {[440, 536, 632, 728, 824].map((x) => (
              <g key={x}>
                <circle cx={x} cy={CL - 80} r="3.5" />
                <circle cx={x} cy={CL + 80} r="3.5" />
              </g>
            ))}
          </g>

          {/* ---- Live system nodes ---- */}
          {NODES.map((node) => (
            <g key={node.label}>
              <circle
                cx={node.x}
                cy={node.y}
                r="5"
                fill="none"
                stroke="var(--color-signal-300)"
                strokeWidth="1.5"
                style={{
                  animation: `ima-ring 3.6s ${node.delay}s ease-out infinite`,
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                }}
              />
              <circle
                cx={node.x}
                cy={node.y}
                r="3.5"
                fill="var(--color-signal-300)"
                filter={`url(#${glowId})`}
                style={{ animation: `ima-node-pulse 3.6s ${node.delay}s ease-in-out infinite` }}
              />
            </g>
          ))}

          {/* Callouts ride with the hull so leader lines stay attached. */}
          <g className="hidden lg:block" aria-hidden="true">
            {NODES.map((node) => {
              const above = node.labelY < CL
              const shelfY = node.labelY + (above ? 10 : -10)
              return (
                <g key={node.label} opacity="0.8">
                  <line x1={node.x} y1={node.y} x2={node.labelX} y2={shelfY} stroke={line} strokeWidth="1" strokeOpacity="0.35" />
                  <line x1={node.labelX - 54} y1={shelfY} x2={node.labelX + 54} y2={shelfY} stroke={line} strokeWidth="1" strokeOpacity="0.35" />
                  <text
                    x={node.labelX}
                    y={node.labelY + (above ? 0 : 4)}
                    textAnchor="middle"
                    className="fill-signal-400 font-mono"
                    style={{ fontSize: '11px', letterSpacing: '0.14em' }}
                  >
                    {node.label}
                  </text>
                </g>
              )
            })}
          </g>

          {/* ---- Principal dimensions ---- */}
          <g
            className="hidden md:block"
            aria-hidden="true"
            stroke={lineDim}
            strokeOpacity="0.35"
            fill={line}
            fillOpacity="0.45"
          >
            <line x1={STERN_X} y1="596" x2={STERN_X} y2="632" strokeWidth="1" />
            <line x1={BOW_X} y1="596" x2={BOW_X} y2="632" strokeWidth="1" />
            <line x1={STERN_X} y1="624" x2={BOW_X} y2="624" strokeWidth="1" />
            <path d={`M ${STERN_X} 624 l 9 -3.5 v 7 z`} stroke="none" />
            <path d={`M ${BOW_X} 624 l -9 -3.5 v 7 z`} stroke="none" />
            <text
              x={(STERN_X + BOW_X) / 2}
              y="617"
              textAnchor="middle"
              stroke="none"
              className="font-mono"
              style={{ fontSize: '9px', letterSpacing: '0.12em' }}
            >
              L.O.A. 189.9 M
            </text>

            <line x1="1088" y1={CL - HALF_BEAM} x2="1120" y2={CL - HALF_BEAM} strokeWidth="1" />
            <line x1="1088" y1={CL + HALF_BEAM} x2="1120" y2={CL + HALF_BEAM} strokeWidth="1" />
            <line x1="1112" y1={CL - HALF_BEAM} x2="1112" y2={CL + HALF_BEAM} strokeWidth="1" />
            <path d={`M 1112 ${CL - HALF_BEAM} l -3.5 9 h 7 z`} stroke="none" />
            <path d={`M 1112 ${CL + HALF_BEAM} l -3.5 -9 h 7 z`} stroke="none" />
            <text
              x="1128"
              y={CL}
              textAnchor="middle"
              stroke="none"
              className="font-mono"
              style={{ fontSize: '9px', letterSpacing: '0.12em' }}
              transform={`rotate(90 1128 ${CL})`}
            >
              B 32.3 M
            </text>
          </g>
        </svg>
      </div>
    </div>
  )
}
