/**
 * Class strings shared across the admin panel. Plain strings rather than
 * components: they go on <button>, <a>, <Link> and <label> alike.
 *
 * Same tokens as the public site, so the panel reads as the same product, but
 * tuned for forms: denser, and every input at 16px so iOS does not zoom the
 * page each time a field is focused.
 */
import { cn } from '@/lib/cn'

export const input =
  'w-full rounded-md border border-navy-700 bg-navy-900/70 px-3 py-2.5 text-base text-white placeholder:text-navy-600 transition-colors focus:border-signal-500 focus:outline-none disabled:opacity-60'

export const label = 'text-navy-200 mb-1.5 block text-sm font-medium'

export const hint = 'text-navy-500 mt-1.5 text-xs leading-relaxed'

export const card = 'border-navy-800 bg-navy-900/40 rounded-lg border'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-signal-500 text-navy-950 hover:bg-signal-400 font-semibold',
  secondary: 'border border-navy-600 text-navy-100 hover:border-signal-400 hover:text-white',
  danger: 'border border-alert-600/60 text-alert-500 hover:bg-alert-600/10',
  ghost: 'text-navy-300 hover:text-white hover:bg-navy-800/60',
}

/** min-h-11 keeps every target at the 44px touch minimum — this panel gets
    used one-handed in the workshop, phone in the other hand. */
export function button(variant: Variant = 'secondary', className?: string): string {
  return cn(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm transition-colors',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    className,
  )
}

/** Square icon-only button (reorder arrows, remove). */
export const iconButton =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-md text-navy-300 transition-colors hover:bg-navy-800 hover:text-white disabled:pointer-events-none disabled:opacity-30'
