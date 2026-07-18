/**
 * Shared symbols for the system diagrams.
 *
 * Every diagram is built from these, which is what makes nine separate
 * drawings read as one set rather than nine unrelated pictures. Stroke
 * weights and type sizes are fixed here on purpose — a diagram that sets its
 * own would immediately look foreign next to the others.
 *
 * Everything draws in `currentColor`, so a diagram is recoloured by setting
 * `color` on its container rather than by threading a prop through.
 *
 * Weights and type sizes live in ./style.
 */
import { STROKE, TYPE } from './style'

/** Busbar with its rating above it. */
export function Bus({
  x1,
  x2,
  y,
  label,
}: {
  x1: number
  x2: number
  y: number
  label?: string
}) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="currentColor" strokeWidth={STROKE.bus} />
      {label && (
        <text
          x={x1}
          y={y - 9}
          fill="currentColor"
          className="font-mono"
          style={{ fontSize: `${TYPE.sub}px`, letterSpacing: '0.14em' }}
        >
          {label}
        </text>
      )}
    </g>
  )
}

/** Square with a cross: a circuit breaker. */
export function Breaker({ x, y, size = 15 }: { x: number; y: number; size?: number }) {
  const h = size / 2
  return (
    <g stroke="currentColor" strokeWidth={STROKE.conductor} fill="none">
      <rect x={x - h} y={y} width={size} height={size} />
      <line x1={x - h} y1={y} x2={x + h} y2={y + size} />
      <line x1={x + h} y1={y} x2={x - h} y2={y + size} />
    </g>
  )
}

/** Rotating machine: a circle carrying its type letter (G, M). */
export function Machine({
  x,
  y,
  letter,
  tag,
  sub,
  r = 14,
}: {
  x: number
  y: number
  letter: string
  tag?: string
  sub?: string
  r?: number
}) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="none" stroke="currentColor" strokeWidth={STROKE.equipment} />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fill="currentColor"
        className="font-mono"
        style={{ fontSize: `${TYPE.glyph}px` }}
      >
        {letter}
      </text>
      {tag && (
        <text
          x={x}
          y={y + r + 14}
          textAnchor="middle"
          fill="currentColor"
          className="font-mono"
          style={{ fontSize: `${TYPE.tag}px`, letterSpacing: '0.06em' }}
        >
          {tag}
        </text>
      )}
      {sub && (
        <text
          x={x}
          y={y + r + 25}
          textAnchor="middle"
          fill="currentColor"
          fillOpacity="0.6"
          className="font-mono"
          style={{ fontSize: `${TYPE.sub}px` }}
        >
          {sub}
        </text>
      )}
    </g>
  )
}

/** Boxed item of equipment: panel, controller, converter. */
export function Block({
  x,
  y,
  w,
  h,
  label,
  sub,
  dashed = false,
}: {
  x: number
  y: number
  w: number
  h: number
  label?: string
  sub?: string
  dashed?: boolean
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE.equipment}
        strokeDasharray={dashed ? '4 3' : undefined}
      />
      {label && (
        <text
          x={x + w / 2}
          y={y + h / 2 + (sub ? -1 : 3)}
          textAnchor="middle"
          fill="currentColor"
          className="font-mono"
          style={{ fontSize: `${TYPE.sub}px`, letterSpacing: '0.08em' }}
        >
          {label}
        </text>
      )}
      {sub && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 9}
          textAnchor="middle"
          fill="currentColor"
          fillOpacity="0.6"
          className="font-mono"
          style={{ fontSize: '6px' }}
        >
          {sub}
        </text>
      )}
    </g>
  )
}

/** Polyline conductor. `signal` draws thin and dashed, for control wiring. */
export function Wire({
  points,
  signal = false,
  opacity = 1,
}: {
  points: [number, number][]
  signal?: boolean
  opacity?: number
}) {
  return (
    <polyline
      points={points.map(([x, y]) => `${x},${y}`).join(' ')}
      fill="none"
      stroke="currentColor"
      strokeWidth={signal ? STROKE.signal : STROKE.conductor}
      strokeDasharray={signal ? '3 3' : undefined}
      strokeOpacity={opacity}
    />
  )
}

/** Filled dot: a tee-off from a bus or loop. */
export function Junction({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r="2.2" fill="currentColor" />
}

/** Small caption, for annotating a run of wiring. */
export function Note({
  x,
  y,
  children,
  anchor = 'middle',
}: {
  x: number
  y: number
  children: string
  anchor?: 'start' | 'middle' | 'end'
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fill="currentColor"
      fillOpacity="0.55"
      className="font-mono"
      style={{ fontSize: '6.5px', letterSpacing: '0.1em' }}
    >
      {children}
    </text>
  )
}
