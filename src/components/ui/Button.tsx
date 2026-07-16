import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'alert' | 'ghost'
type Size = 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-signal-500 text-navy-950 hover:bg-signal-400 font-semibold',
  secondary:
    'border border-navy-600 text-navy-100 hover:border-signal-400 hover:text-white hover:bg-navy-800/60',
  alert: 'bg-alert-600 text-navy-950 hover:bg-alert-500 font-semibold',
  ghost: 'text-navy-200 hover:text-white hover:bg-navy-800/60',
}

const SIZES: Record<Size, string> = {
  // min-h keeps every target at/above the 44px touch minimum on phones.
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-13 px-6 text-base',
}

function classes(variant: Variant, size: Size, className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md transition-colors duration-200',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <button className={classes(variant, size, className)} {...props}>
      {children}
    </button>
  )
}

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  to: string
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}) {
  // Anything non-internal (tel:, mailto:, https:) has to be a plain anchor —
  // the router would try to resolve it as a path.
  const isExternal = /^(https?:|tel:|mailto:)/.test(to)

  if (isExternal) {
    return (
      <a href={to} className={classes(variant, size, className)}>
        {children}
      </a>
    )
  }

  return (
    <Link to={to} className={classes(variant, size, className)}>
      {children}
    </Link>
  )
}
