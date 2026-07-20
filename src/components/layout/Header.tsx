import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useI18n } from '@/i18n/useI18n'
import { ROUTES, type RouteKey } from '@/routes'
import { cn } from '@/lib/cn'
import { Logo } from './Logo'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ButtonLink } from '@/components/ui/Button'

const NAV_KEYS: RouteKey[] = ['services', 'capabilities', 'projects', 'certifications', 'coverage']

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
      ) : (
        <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
      )}
    </svg>
  )
}

export function Header() {
  const { t } = useI18n()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Solid bar once we're off the hero, transparent while over it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // A menu left open across a navigation would cover the page you just opened.
  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    // Stop the page behind the panel from scrolling under the user's finger.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open])

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'text-sm transition-colors',
      isActive ? 'text-signal-400 font-medium' : 'text-navy-300 hover:text-white',
    )

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
        scrolled || open
          ? 'bg-navy-950/90 border-navy-800 border-b backdrop-blur-md'
          : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:h-18 lg:px-12">
        <Link to={ROUTES.home} aria-label="IMA">
          {/* compact: see the note on the prop — the intro curtain passes the
              same, and the two must not diverge. */}
          <Logo name="compact" />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
          {NAV_KEYS.map((key) => (
            <NavLink key={key} to={ROUTES[key]} className={navLinkClass}>
              {t.nav[key]}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Both are wrapped rather than handed `hidden` directly: each has
              inline-flex in its own base classes, and cn is a plain join — the
              conflicting display utilities tie and the stylesheet's later one
              (inline-flex) wins, so the `hidden` never took effect and the
              phone bar showed everything at once. A wrapper has no display
              class of its own to fight the breakpoint. */}
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>

          <div className="hidden lg:block">
            <ButtonLink to={ROUTES.contact} size="md">
              {t.nav.contact}
            </ButtonLink>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t.nav.close : t.nav.menu}
            className="text-navy-100 inline-flex size-11 items-center justify-center rounded-md lg:hidden"
          >
            <MenuIcon open={open} />
          </button>
        </div>
      </div>

      {/* Mobile panel. Rendered inside the header so focus order stays sane. */}
      <div
        id="mobile-nav"
        hidden={!open}
        className="bg-navy-950/97 border-navy-800 h-[calc(100dvh-4rem)] overflow-y-auto border-t backdrop-blur-md lg:hidden"
      >
        <nav className="flex flex-col px-5 py-4 sm:px-8" aria-label="Mobile">
          {(['home', ...NAV_KEYS, 'contact'] as RouteKey[]).map((key) => (
            <NavLink
              key={key}
              to={ROUTES[key]}
              className={({ isActive }) =>
                cn(
                  'border-navy-800/70 flex min-h-14 items-center border-b text-lg transition-colors',
                  isActive ? 'text-signal-400 font-medium' : 'text-navy-200',
                )
              }
            >
              {t.nav[key]}
            </NavLink>
          ))}
        </nav>

        <div className="flex flex-col gap-4 px-5 pt-2 pb-10 sm:px-8">
          <LanguageSwitcher className="self-start sm:hidden" />
        </div>
      </div>
    </header>
  )
}
