import type { ReactNode } from 'react'
import { Brand } from './Brand'
import { card } from './styles'

/** Centred card for everything shown before the panel proper: sign-in,
    password reset, and the reasons someone cannot get in. */
export function AuthScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="blueprint-grid absolute inset-0 opacity-40" aria-hidden="true" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>
        <div className={`${card} bg-navy-950/90 p-6 sm:p-8`}>
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </main>
  )
}
