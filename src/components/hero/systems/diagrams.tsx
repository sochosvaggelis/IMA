import { Block, Breaker, Bus, Junction, Machine, Note, Wire } from './symbols'
import { STROKE } from './style'

/**
 * The nine system diagrams.
 *
 * Each is drawn to the conventions of the real marine document it stands in
 * for — a single-line for the switchboards, a loop schematic for fire
 * detection, a block diagram for the automation. They are deliberately
 * SCHEMATIC rather than pictorial: a superintendent reads a single-line
 * instantly, and it says far more about what the yard actually does than a
 * rendering of a generator would.
 *
 * All share one viewBox so the panel never changes height between systems,
 * which would make the whole panel jump as you scroll from one to the next.
 */

const VB = '0 0 360 205'

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={VB} className="text-signal-400 w-full" aria-hidden="true">
      {children}
    </svg>
  )
}

/* -------------------------------------------------- 01 power generation --- */
/* Three sets on the main bus, emergency board behind a normally-open tie. */
export function PowerGeneration() {
  const BUS = 62
  const BRK = 92
  const MACH = 146
  const sets = [
    { x: 62, tag: 'DG 1', sub: '600 kW' },
    { x: 142, tag: 'DG 2', sub: '600 kW' },
    { x: 222, tag: 'DG 3', sub: '600 kW' },
  ]
  return (
    <Frame>
      <Bus x1={28} x2={268} y={BUS} label="MAIN SWITCHBOARD · 440V 60Hz" />
      {sets.map((s) => (
        <g key={s.tag}>
          <Junction x={s.x} y={BUS} />
          <Wire points={[[s.x, BUS], [s.x, BRK]]} />
          <Breaker x={s.x} y={BRK} />
          <Wire points={[[s.x, BRK + 15], [s.x, MACH - 14]]} />
          <Machine x={s.x} y={MACH} letter="G" tag={s.tag} sub={s.sub} />
        </g>
      ))}
      {/* Bus tie is dashed because it is open in normal service — closing it
          is the whole function of the emergency board. */}
      <Wire points={[[268, BUS], [300, BUS]]} signal opacity={0.7} />
      <Note x={284} y={BUS - 7}>N.O.</Note>
      <Bus x1={300} x2={344} y={BUS} />
      <Note x={322} y={BUS - 20}>EMCY SWBD</Note>
      <Wire points={[[322, BUS], [322, BRK]]} />
      <Breaker x={322} y={BRK} />
      <Wire points={[[322, BRK + 15], [322, MACH - 14]]} />
      <Machine x={322} y={MACH} letter="G" tag="EG" sub="200 kW" />
    </Frame>
  )
}

/* ------------------------------------------------ 02 power distribution --- */
/* Main bus feeding group panels, plus the 440/220 transformer for services. */
export function PowerDistribution() {
  const BUS = 52
  const feeders = [
    { x: 52, label: 'ENGINE', sub: 'GROUP STARTER' },
    { x: 132, label: 'DECK', sub: 'CARGO / MOORING' },
    { x: 212, label: 'ACCOM', sub: 'HOTEL LOAD' },
  ]
  return (
    <Frame>
      <Bus x1={26} x2={334} y={BUS} label="MAIN BUS · 440V 3PH" />
      {feeders.map((f) => (
        <g key={f.label}>
          <Junction x={f.x} y={BUS} />
          <Wire points={[[f.x, BUS], [f.x, 78]]} />
          <Breaker x={f.x} y={78} />
          <Wire points={[[f.x, 93], [f.x, 110]]} />
          <Block x={f.x - 36} y={110} w={72} h={26} label={f.label} sub={f.sub} />
        </g>
      ))}
      {/* Transformer: two overlapping coils, feeding the 220V services bus. */}
      <Junction x={300} y={BUS} />
      <Wire points={[[300, BUS], [300, 76]]} />
      <circle cx={300} cy={86} r="10" fill="none" stroke="currentColor" strokeWidth={STROKE.equipment} />
      <circle cx={300} cy={98} r="10" fill="none" stroke="currentColor" strokeWidth={STROKE.equipment} />
      <Note x={332} y={92} anchor="end">440/220</Note>
      <Wire points={[[300, 108], [300, 124]]} />
      <Bus x1={266} x2={334} y={124} />
      <Note x={300} y={140}>220V SERVICES</Note>
      <Note x={26} y={170} anchor="start">SELECTIVE COORDINATION · PREFERENTIAL TRIP</Note>
      <Note x={26} y={184} anchor="start">INSULATION MONITORING ON EACH BUS SECTION</Note>
    </Frame>
  )
}

/* --------------------------------------------- 03 electric motors/drives --- */
/* One starter per motor: direct-on-line, star-delta, and a frequency drive. */
export function MotorsAndDrives() {
  const BUS = 44
  const items = [
    { x: 60, kind: 'DOL', tag: 'BALLAST', sub: '55 kW' },
    { x: 180, kind: 'Y/Δ', tag: 'CARGO PUMP', sub: '110 kW' },
    { x: 300, kind: 'VFD', tag: 'BOW THRUSTER', sub: '750 kW' },
  ]
  return (
    <Frame>
      <Bus x1={26} x2={334} y={BUS} label="POWER FEED" />
      {items.map((m) => (
        <g key={m.tag}>
          <Junction x={m.x} y={BUS} />
          <Wire points={[[m.x, BUS], [m.x, 66]]} />
          <Breaker x={m.x} y={66} />
          <Wire points={[[m.x, 81], [m.x, 96]]} />
          <Block x={m.x - 26} y={96} w={52} h={24} label={m.kind} />
          {/* Overload relay between starter and machine. */}
          <Wire points={[[m.x, 120], [m.x, 132]]} />
          <rect
            x={m.x - 7}
            y={132}
            width={14}
            height={9}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE.conductor}
          />
          <Wire points={[[m.x, 141], [m.x, 154]]} />
          <Machine x={m.x} y={168} letter="M" tag={m.tag} sub={m.sub} />
        </g>
      ))}
      <Note x={26} y={196} anchor="start">OVERLOAD · PHASE FAILURE · BEARING TEMPERATURE</Note>
    </Frame>
  )
}

/* --------------------------------------------------- 04 automation/ctrl --- */
/* Sensors in, controller, actuators out, with the alarm bus to the bridge. */
export function AutomationControl() {
  const inputs = ['TEMP', 'PRESS', 'LEVEL', 'FLOW']
  return (
    <Frame>
      <Note x={30} y={26} anchor="start">FIELD INPUTS</Note>
      {inputs.map((t, i) => {
        const y = 44 + i * 30
        return (
          <g key={t}>
            <Block x={26} y={y - 10} w={54} h={20} label={t} />
            <Wire points={[[80, y], [128, y], [128, 100]]} signal />
          </g>
        )
      })}

      <Block x={128} y={62} w={96} h={76} label="PLC / UMS" sub="REDUNDANT CPU" />

      {/* Outputs to final elements. */}
      {['VALVES', 'STARTERS', 'DAMPERS'].map((t, i) => {
        const y = 76 + i * 30
        return (
          <g key={t}>
            <Wire points={[[224, 100], [272, 100], [272, y], [286, y]]} signal />
            <Block x={286} y={y - 10} w={48} h={20} label={t} />
          </g>
        )
      })}

      {/* Alarm and monitoring bus up to the bridge — dashed: it is data. */}
      <Wire points={[[176, 62], [176, 34], [300, 34]]} signal opacity={0.8} />
      <Note x={238} y={28}>ALARM BUS → BRIDGE</Note>
      <Note x={30} y={176} anchor="start">UNATTENDED MACHINERY SPACE · WATCHCALL</Note>
      <Note x={30} y={190} anchor="start">LOOP TUNING · SETPOINT TRENDING · EVENT LOG</Note>
    </Frame>
  )
}

/* ----------------------------------------------- 05 navigation/comms --- */
/* Mast-mounted sensors down to the bridge console, on redundant supplies. */
export function NavigationComms() {
  const mast = 92
  const gear = [
    { y: 34, tag: 'RADAR X / S BAND' },
    { y: 62, tag: 'GNSS / DGPS' },
    { y: 90, tag: 'AIS / VDR' },
    { y: 118, tag: 'GMDSS · VHF / MF-HF' },
  ]
  return (
    <Frame>
      {/* Mast */}
      <Wire points={[[mast, 24], [mast, 150]]} />
      {gear.map((g) => (
        <g key={g.tag}>
          <Junction x={mast} y={g.y} />
          <Wire points={[[mast, g.y], [mast - 30, g.y]]} />
          <circle cx={mast - 38} cy={g.y} r="7" fill="none" stroke="currentColor" strokeWidth={STROKE.equipment} />
          <text
            x={mast + 10}
            y={g.y + 3}
            fill="currentColor"
            className="font-mono"
            style={{ fontSize: '7px', letterSpacing: '0.08em' }}
          >
            {g.tag}
          </text>
        </g>
      ))}

      <Wire points={[[mast, 150], [232, 150], [232, 128]]} />
      <Block x={196} y={96} w={72} h={32} label="BRIDGE" sub="CONSOLE" />

      {/* Gyro and autopilot hang off the console. */}
      <Wire points={[[268, 112], [300, 112]]} signal />
      <Block x={300} y={100} w={34} h={24} label="GYRO" />
      <Wire points={[[232, 96], [232, 74]]} signal />
      <Block x={196} y={50} w={72} h={24} label="AUTOPILOT" />

      <Note x={26} y={176} anchor="start">DUAL SUPPLY · MAIN + EMERGENCY + BATTERY</Note>
      <Note x={26} y={190} anchor="start">ANNUAL RADIO SURVEY · PERFORMANCE TEST</Note>
    </Frame>
  )
}

/* --------------------------------------------------- 06 cargo systems --- */
/* Deck ring main feeding cranes, hatch covers and hold services. */
export function CargoSystems() {
  const RING = 58
  const loads = [
    { x: 58, label: 'CRANE 1' },
    { x: 138, label: 'CRANE 2' },
    { x: 218, label: 'HATCH' },
    { x: 298, label: 'HOLD FAN' },
  ]
  return (
    <Frame>
      <Bus x1={26} x2={334} y={RING} label="DECK RING MAIN" />
      {loads.map((l) => (
        <g key={l.label}>
          <Junction x={l.x} y={RING} />
          <Wire points={[[l.x, RING], [l.x, 80]]} />
          <Breaker x={l.x} y={80} />
          <Wire points={[[l.x, 95], [l.x, 108]]} />
          <Block x={l.x - 30} y={108} w={60} h={24} label={l.label} />
        </g>
      ))}

      {/* Hold instrumentation reporting back to the cargo console. */}
      {loads.map((l) => (
        <Wire key={`s-${l.x}`} points={[[l.x, 132], [l.x, 152]]} signal />
      ))}
      <Wire points={[[58, 152], [298, 152]]} signal />
      <Wire points={[[178, 152], [178, 168]]} signal />
      <Block x={130} y={168} w={96} h={22} label="CARGO CONSOLE" />
      <Note x={334} y={148} anchor="end">HOLD BILGE · TEMP</Note>
    </Frame>
  )
}

/* --------------------------------------------- 07 engine room electrical --- */
/* The auxiliaries hung off the engine group starter panel. */
export function EngineRoomElectrical() {
  const BUS = 46
  const aux = [
    { x: 54, tag: 'PURIFIER' },
    { x: 130, tag: 'AIR COMP' },
    { x: 206, tag: 'BOILER' },
    { x: 282, tag: 'ER FANS' },
  ]
  return (
    <Frame>
      <Bus x1={26} x2={334} y={BUS} label="ENGINE GROUP STARTER PANEL" />
      {aux.map((a) => (
        <g key={a.tag}>
          <Junction x={a.x} y={BUS} />
          <Wire points={[[a.x, BUS], [a.x, 70]]} />
          <Breaker x={a.x} y={70} />
          <Wire points={[[a.x, 85], [a.x, 102]]} />
          <Machine x={a.x} y={116} letter="M" tag={a.tag} r={13} />
        </g>
      ))}

      {/* Earth-fault monitoring watches the whole bus, not one feeder. */}
      <Wire points={[[26, BUS], [26, 160], [334, 160], [334, BUS]]} signal opacity={0.6} />
      <Block x={130} y={148} w={100} h={24} label="EARTH FAULT" sub="MONITOR" />
      <Note x={26} y={192} anchor="start">SHAFT EARTHING · CATHODIC PROTECTION · MEGGER LOG</Note>
    </Frame>
  )
}

/* ------------------------------------------- 08 lighting / accommodation --- */
/* Normal and emergency lighting, and the changeover between them. */
export function LightingAccommodation() {
  const NORMAL = 44
  const EMCY = 150
  const decks = [
    { x: 64, label: 'A DECK' },
    { x: 154, label: 'B DECK' },
    { x: 244, label: 'GALLEY' },
  ]
  return (
    <Frame>
      <Bus x1={26} x2={310} y={NORMAL} label="LIGHTING DB · 220V" />
      {decks.map((d) => (
        <g key={d.label}>
          <Junction x={d.x} y={NORMAL} />
          <Wire points={[[d.x, NORMAL], [d.x, 66]]} />
          <Breaker x={d.x} y={66} size={13} />
          <Wire points={[[d.x, 79], [d.x, 92]]} />
          <Block x={d.x - 34} y={92} w={68} h={22} label={d.label} />
          {/* Luminaire: circle with a cross. */}
          <Wire points={[[d.x, 114], [d.x, 124]]} />
          <circle cx={d.x} cy={131} r="7" fill="none" stroke="currentColor" strokeWidth={STROKE.conductor} />
          <line x1={d.x - 5} y1={126} x2={d.x + 5} y2={136} stroke="currentColor" strokeWidth={STROKE.signal} />
          <line x1={d.x + 5} y1={126} x2={d.x - 5} y2={136} stroke="currentColor" strokeWidth={STROKE.signal} />
        </g>
      ))}

      <Bus x1={26} x2={310} y={EMCY} />
      <Note x={26} y={EMCY + 14} anchor="start">EMERGENCY LIGHTING · 24V DC BATTERY BACKED</Note>
      {/* Automatic changeover, drawn dashed: normally not conducting. */}
      <Wire points={[[326, NORMAL], [326, EMCY]]} signal opacity={0.7} />
      <Block x={306} y={88} w={40} h={22} label="ACOS" dashed />
      <Note x={26} y={190} anchor="start">NAV LIGHT PANEL · FAILURE ALARM PER CIRCUIT</Note>
    </Frame>
  )
}

/* -------------------------------------------------- 09 safety systems --- */
/* Addressable detection loop, general alarm, and the emergency stops. */
export function SafetySystems() {
  const detectors = [
    { x: 70, y: 62 },
    { x: 140, y: 62 },
    { x: 210, y: 62 },
    { x: 280, y: 62 },
  ]
  return (
    <Frame>
      <Block x={128} y={150} w={104} h={28} label="FIRE PANEL" sub="ADDRESSABLE" />

      {/* A detection loop returns to the panel, so a single break cannot
          isolate any device — drawn as a closed circuit for that reason. */}
      <Wire points={[[180, 150], [180, 128], [40, 128], [40, 62], [70, 62]]} />
      <Wire points={[[280, 62], [320, 62], [320, 128], [180, 128]]} />
      <Wire points={[[70, 62], [280, 62]]} />
      {detectors.map((d, i) => (
        <g key={d.x}>
          <circle cx={d.x} cy={d.y} r="8" fill="none" stroke="currentColor" strokeWidth={STROKE.equipment} />
          <circle cx={d.x} cy={d.y} r="3" fill="currentColor" fillOpacity="0.7" />
          <Note x={d.x} y={d.y - 14}>{`Z${i + 1}`}</Note>
        </g>
      ))}
      <Note x={180} y={122}>LOOP · RETURN TO PANEL</Note>

      {/* General alarm and emergency stops. */}
      <Wire points={[[128, 164], [70, 164], [70, 186]]} signal />
      <Note x={70} y={198}>GENERAL ALARM</Note>
      <Wire points={[[232, 164], [292, 164], [292, 186]]} signal />
      <Note x={292} y={198}>EMCY STOP · FUEL / FANS</Note>
    </Frame>
  )
}
