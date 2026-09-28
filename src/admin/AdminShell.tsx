import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ADMIN_ROOT } from '@/routes'
import { cn } from '@/lib/cn'
import { db } from './client'
import { COLLECTIONS } from './collections'
import { confirmLeave } from './unsaved'
import { Brand } from './Brand'
import { button } from './styles'

/** For every in-panel link: an editor with unsaved changes gets to object. */
function guard(event: MouseEvent) {
  if (!confirmLeave()) event.preventDefault()
}

export function AdminShell({ email, children }: { email: string; children: ReactNode }) {
  const sections = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  // On a phone the tabs scroll sideways; keep the current one in view,
  // including when a page is opened directly rather than by tapping its tab.
  useEffect(() => {
    sections.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname])

  async function signOut() {
    if (!confirmLeave()) return
    await db().auth.signOut()
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-navy-800 bg-navy-950/95 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-3 sm:px-6">
          <Link to={ADMIN_ROOT} onClick={guard} aria-label="Admin home">
            <Brand />
          </Link>
          <div className="flex min-w-0 items-center gap-1 whitespace-nowrap sm:gap-2">
            {/* Wrapped, not given `hidden` directly: button() carries
                inline-flex, and cn is a plain join — the same trap as the
                site header's (see Header.tsx). */}
            <div className="hidden sm:block">
              <a href={import.meta.env.BASE_URL} target="_blank" rel="noreferrer" className={button('ghost', 'px-3')}>
                View site ↗
              </a>
            </div>
            <NavLink
              to={`${ADMIN_ROOT}/account`}
              onClick={guard}
              className={({ isActive }) =>
                button('ghost', cn('min-w-0 px-2.5 sm:px-3', isActive && 'text-signal-400'))
              }
              title={email}
            >
              <span className="hidden max-w-[16rem] truncate md:inline">{email}</span>
              <span className="md:hidden">Account</span>
            </NavLink>
            <button type="button" onClick={signOut} className={button('ghost', 'px-2.5 sm:px-3')}>
              Sign out
            </button>
          </div>
        </div>
        <nav ref={sections} aria-label="Sections" className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6">
          {COLLECTIONS.map((collection) => (
            <NavLink
              key={collection.slug}
              to={`${ADMIN_ROOT}/${collection.slug}`}
              onClick={guard}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center border-b-2 px-3 text-sm whitespace-nowrap transition-colors',
                  isActive
                    ? 'border-signal-500 text-white'
                    : 'text-navy-400 border-transparent hover:text-white',
                )
              }
            >
              {collection.title}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}
