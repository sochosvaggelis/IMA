import { cn } from '@/lib/cn'

/**
 * Colourways of the company badge. `navy` is the artwork as supplied and is
 * for light backgrounds; the other two are generated from it by
 * scripts/recolour-logo.mjs and exist because this site is dark.
 */
const SOURCES = {
  signal: 'logo-signal.png',
  white: 'logo-white.png',
  navy: 'logo.png',
} as const

/** The badge as drawn, at its native pixel size — given to the img so the
    header reserves the right box before the file arrives and nothing shifts. */
const NATURAL = { width: 153, height: 160 }

/** The company badge, with the initials and full name set beside it.
 *
 * The badge carries the name in its ring too, but that ring is only ~10px tall
 * in the artwork: at any header-sized rendering it reads as texture, not text.
 * So the type beside it does the reading, and spells the name out in full. */
export function Logo({
  className,
  variant = 'signal',
}: {
  className?: string
  variant?: keyof typeof SOURCES
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {/* Lives in public/, so the base path has to be applied at runtime:
          GitHub Pages serves this site from /IMA/ while dev serves from /.
          BASE_URL carries its own trailing slash in both modes. */}
      <img
        src={`${import.meta.env.BASE_URL}${SOURCES[variant]}`}
        alt=""
        aria-hidden="true"
        width={NATURAL.width}
        height={NATURAL.height}
        // Height-driven with width auto: the artwork is not square, and a
        // square box would letterbox it off its own centre.
        className="h-12 w-auto shrink-0"
      />
      <span className="flex flex-col leading-none">
        {/* leading-none explicitly: text-lg carries its own 1.75rem line
            height, which the container's leading-none does not override, and
            those 10 extra pixels left the lockup all but touching the top and
            bottom of the phone header. */}
        <span className="text-lg leading-none font-bold tracking-tight text-white">IMA</span>
        {/* The full name, set out over two lines beneath the initials.
            whitespace-nowrap on both: the column is only as wide as the
            longest line, and at phone width "Marine Automations" would
            otherwise break and turn a three-line lockup into four.

            Tracking is looser than the type scale's default because these are
            small caps set in mono — but it is tighter than the 0.14em used
            elsewhere for micro-labels, since at this size that much letter
            spacing pushed the lockup wide enough to crowd the phone header. */}
        <span className="text-navy-300 mt-1.5 flex flex-col gap-1 font-mono text-xs leading-none tracking-[0.1em] whitespace-nowrap uppercase">
          <span>International</span>
          <span>Marine Automations</span>
        </span>
      </span>
    </span>
  )
}
