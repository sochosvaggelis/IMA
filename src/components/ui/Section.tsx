import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Container } from './Container'

export function Section({
  children,
  className,
  id,
  size = 'default',
  tone = 'base',
}: {
  children: ReactNode
  className?: string
  id?: string
  size?: 'default' | 'narrow' | 'wide'
  tone?: 'base' | 'raised'
}) {
  return (
    <section
      id={id}
      className={cn(
        'py-16 sm:py-20 lg:py-28',
        tone === 'raised' && 'bg-navy-900/40 border-y border-navy-800/60',
        className,
      )}
    >
      <Container size={size}>{children}</Container>
    </section>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = 'left',
  className,
}: {
  eyebrow?: string
  title: string
  intro?: string
  align?: 'left' | 'center'
  className?: string
}) {
  return (
    <div
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 className="text-h2 text-white text-balance font-semibold">{title}</h2>
      {intro && <p className="text-navy-300 mt-5 text-base leading-relaxed sm:text-lg">{intro}</p>}
    </div>
  )
}
