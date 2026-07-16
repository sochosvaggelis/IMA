import { cn } from '@/lib/cn'

/** Wordmark: a top-down hull glyph echoing the hero, plus the initials. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden="true">
        <circle cx="16" cy="16" r="15" className="fill-navy-800 stroke-signal-500/50" strokeWidth="1" />
        <path
          d="M 7 12 L 20 12 C 24 12.4, 26 14, 27 16 C 26 18, 24 19.6, 20 20 L 7 20 C 5.6 20, 5 18.8, 5 16 C 5 13.2, 5.6 12, 7 12 Z"
          className="fill-signal-500/20 stroke-signal-400"
          strokeWidth="1.4"
        />
        <line x1="5" y1="16" x2="27" y2="16" className="stroke-signal-400/40" strokeWidth="0.8" strokeDasharray="2 2" />
        <circle cx="10" cy="16" r="1.8" className="fill-signal-300" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-base font-bold tracking-tight text-white">IMA</span>
        <span className="text-navy-400 font-mono text-[9px] tracking-[0.14em] uppercase">
          Marine Automations
        </span>
      </span>
    </span>
  )
}
