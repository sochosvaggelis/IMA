import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Horizontal gutter + max width for every band on the site.
 * Gutters grow with the viewport so text never touches a phone bezel.
 */
export function Container({
  children,
  className,
  size = 'default',
}: {
  children: ReactNode
  className?: string
  size?: 'default' | 'narrow' | 'wide'
}) {
  const width = {
    narrow: 'max-w-3xl',
    default: 'max-w-6xl',
    wide: 'max-w-7xl',
  }[size]

  return (
    <div className={cn('mx-auto w-full px-5 sm:px-8 lg:px-12', width, className)}>{children}</div>
  )
}
