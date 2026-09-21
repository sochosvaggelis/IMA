import { cn } from '@/lib/cn'

/* The same hexes the globe and the vessel scene draw in, so every piece of
   linework on the site shares one palette. Cyan for structure, amber reserved
   for the one thing that matters — there, the hub port; here, the seal. */
const COLOR = {
  signal500: '#00b4d5',
  signal300: '#7ae4f3',
  alert500: '#f49329',
} as const

/**
 * A certificate as a blueprint wire drawing — the page backdrop for
 * /certifications, answering the coverage globe.
 *
 * Deliberately flat SVG rather than WebGL. The globe earns a three.js context
 * because it rotates and carries real coastline geometry; this is a still
 * background image, and rendering it as markup keeps the certifications route
 * off the 880 kB three.js chunk entirely (see the route splitting in App.tsx).
 *
 * Drawn at the same stroke weight and opacity as GlobeFallback in
 * CoverageGlobe.tsx, so the two pages read as one hand.
 */
export function CertificateBackdrop({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      {/* Cyan bloom behind the sheet, so it sits in light rather than on a
          flat field — the same trick the globe and the blueprint sections use. */}
      <div
        className="pointer-events-none absolute inset-[8%] blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse, color-mix(in oklab, var(--color-signal-500) 26%, transparent), transparent 68%)',
        }}
        aria-hidden="true"
      />

      <svg viewBox="0 0 240 180" className="relative h-full w-full" aria-hidden="true">
        <g fill="none" stroke={COLOR.signal500} strokeWidth="0.6" opacity="0.5">
          {/* The sheet, and the ruled border every certificate carries. */}
          <rect x="8" y="8" width="224" height="164" />
          <rect x="16" y="16" width="208" height="148" />

          {/* Corner ticks — draughtsman's registration marks. */}
          {[
            [16, 16, 1, 1],
            [224, 16, -1, 1],
            [16, 164, 1, -1],
            [224, 164, -1, -1],
          ].map(([x, y, dx, dy]) => (
            <path key={`${x}-${y}`} d={`M${x} ${y + dy * 10} V${y} H${x + dx * 10}`} />
          ))}

          {/* Title block: two centred rules standing in for the awarded name. */}
          <line x1="72" y1="44" x2="168" y2="44" strokeWidth="1.4" />
          <line x1="94" y1="54" x2="146" y2="54" />

          {/* Body copy, ragged like real set text rather than a solid block. */}
          <line x1="44" y1="76" x2="196" y2="76" />
          <line x1="44" y1="86" x2="176" y2="86" />
          <line x1="44" y1="96" x2="188" y2="96" />
          <line x1="44" y1="106" x2="132" y2="106" />

          {/* Signature rule, bottom left, clear of the seal. */}
          <line x1="40" y1="140" x2="104" y2="140" />

          {/* Seal: concentric rings with a toothed rosette, bottom right. */}
          <circle cx="176" cy="130" r="23" />
          <circle cx="176" cy="130" r="16" />
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i / 24) * Math.PI * 2
            return (
              <line
                key={i}
                x1={176 + Math.cos(a) * 16}
                y1={130 + Math.sin(a) * 16}
                x2={176 + Math.cos(a) * 23}
                y2={130 + Math.sin(a) * 23}
              />
            )
          })}

          {/* Ribbon tails falling from the seal. */}
          <path d="M168 150 L164 172 L172 166 L178 172 L180 150" />
        </g>

        {/* Amber ring: the single focal accent, matching the hub port on the
            globe. Kept off the group above so it holds its own opacity. */}
        <circle
          cx="176"
          cy="130"
          r="9.5"
          fill="none"
          stroke={COLOR.alert500}
          strokeWidth="1"
          opacity="0.75"
        />
        {/* The approval mark itself — the same check the cards carry. */}
        <path
          d="M171 130.5l3.5 3.5 6-7"
          fill="none"
          stroke={COLOR.signal300}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
      </svg>
    </div>
  )
}
